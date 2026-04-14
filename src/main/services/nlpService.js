import OpenAI from 'openai'

let qaPipeline = null
async function getQaPipeline() {
  if (!qaPipeline) {
    const { pipeline, env } = await import('@xenova/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = false
    qaPipeline = await pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad', {
      quantized: true,
    })
  }
  return qaPipeline
}
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const NVIDIA_MODEL = 'nvidia/nemotron-3-nano-30b-a3b'

function getClient() {
  if (process.env.USE_LOCAL_ML === 'true') {
    return {
      client: new OpenAI({
        baseURL: process.env.LOCAL_ML_URL || 'http://localhost:11434/v1',
        apiKey: 'local',
      }),
      model: process.env.LOCAL_ML_MODEL || 'qwen2.5:0.5b'
    }
  }

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY not set in environment. Go to Settings and add it, or enable Local ML.')
  return {
    client: new OpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey
    }),
    model: NVIDIA_MODEL
  }
}

export function generateSearchQueries(params) {
  const {
    companies = [],
    companyTypes = [],
    hasCompanyList,
    city,
    district,
    state,
    pincodes = [],
    searchScope
  } = params

  const targets = hasCompanyList ? companies : companyTypes
  const locationParts = [district, city, state].filter(Boolean)
  const locationStr = locationParts.join(', ')
  const queries = []

  for (const target of targets) {
    if (searchScope === 'narrow' && pincodes.length > 0) {
      // Narrow: category + pincode + district + city + state
      for (const pincode of pincodes) {
        const parts = [target, pincode, district, city, state].filter(Boolean)
        queries.push({ 
          query: parts.join(' '), 
          target, 
          pincode, 
          location: locationStr 
        })
      }
    } else {
      // Broader: company name + district + city + state (no pincode)
      const parts = [target, district, city, state].filter(Boolean)
      queries.push({ 
        query: parts.join(' '), 
        target, 
        pincode: 'all', 
        location: locationStr 
      })
    }
  }

  const summary = `${queries.length} search ${queries.length === 1 ? 'query' : 'queries'} for ${targets.length} target(s) in ${locationStr || 'specified area'}.`
  return { queries, summary }
}

export async function normalizeApolloCity(locationStr) {
  if (!locationStr) return ''
  const { client, model } = getClient()

  const prompt = `You are a data standardization assistant for Apollo.io.
The user wants to find leads in the following location: "${locationStr}".
Convert this location into the canonical CITY name that Apollo.io prefers.
Rules:
- Strip out Country names (e.g. "Mumbai, India" -> "Mumbai")
- Strip out State names if it's a major known city (e.g. "Bangalore, Karnataka" -> "Bengaluru")
- Use the widely accepted modern spelling (e.g. "Bangalore" -> "Bengaluru", "Bombay" -> "Mumbai")
- If the location is too broad (like "India"), return it as is or return the capital if necessary, but ideally just return the exact city format.
- Do NOT provide explanations.

Return ONLY a valid JSON object:
{ "city": "Canonical City Name" }`

  let fullText = ''
  try {
    const stream = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
      stream: true
    })

    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue
      const delta = chunk.choices[0].delta
      if (delta?.content) fullText += delta.content
    }
  } catch (e) {
    // If Local ML fails on Apollo normalize, just return raw string
    return locationStr
  }

  const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullText.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : fullText.trim()

  try {
    const data = JSON.parse(jsonStr)
    return data.city || locationStr
  } catch {
    return locationStr // fallback
  }
}

export async function extractRevenueWithQA(text) {
  if (!text) return null
  try {
    const qa = await getQaPipeline()
    const result = await qa('What is the revenue or turnover?', text)
    if (result && result.score > 0.1 && result.answer) {
      return result.answer
    }
    return null
  } catch (err) {
    console.error('QA Model Error:', err)
    return null
  }
}

/**
 * Returns a cleaned LinkedIn profile URL if it looks valid, or '' if it's likely hallucinated.
 * Valid format: https://www.linkedin.com/in/<slug>
 * where <slug> is not a placeholder, not purely numeric, and at least 3 chars.
 */
function validateLinkedInUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return ''
  let url = rawUrl.trim()

  // Strip query params and fragments (tracking junk)
  try {
    const parsed = new URL(url)
    url = parsed.origin + parsed.pathname
  } catch {
    return '' // not a valid URL at all
  }

  // Must be a linkedin.com profile URL
  if (!url.match(/^https?:\/\/(www\.)?linkedin\.com\/in\//i)) return ''

  // Extract the slug after /in/
  const slugMatch = url.match(/\/in\/([^/]+)\/?$/)
  if (!slugMatch) return ''
  const slug = slugMatch[1].toLowerCase()

  // Reject known hallucination patterns
  const PLACEHOLDER_SLUGS = [
    'your-name', 'yourname', 'username', 'profile', 'name', 'person',
    'contact', 'user', 'linkedin', 'example', 'placeholder', '...'
  ]
  if (PLACEHOLDER_SLUGS.includes(slug)) return ''

  // Reject if slug contains known hallucination strings
  if (slug.includes('111111') || slug.includes('000000') || slug.includes('123456')) return ''

  // Reject if slug is purely numeric (hallucinated ID)
  if (/^\d+$/.test(slug)) return ''

  // Reject if slug is too short to be real
  if (slug.length < 3) return ''

  // Reject if slug ends with just digits that look like a fake suffix (e.g., -11111111)
  if (/-\d{7,}$/.test(slug)) return ''

  // Looks valid — normalize to www.linkedin.com
  return url.replace(/^https?:\/\/linkedin\.com\/in\//i, 'https://www.linkedin.com/in/')
}

export async function extractContactWithQA(text, realLinkedInUrls = []) {
  if (!text) return []
  const { client, model } = getClient()

  // Build the URL section that the LLM is allowed to use
  const hasRealUrls = realLinkedInUrls.length > 0
  const urlSection = hasRealUrls
    ? `\nAVAILABLE LINKEDIN URLS (these are the ONLY real URLs found on this page — use only these):\n${realLinkedInUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : '\n(No LinkedIn URLs were found on this page. Leave linkedinUrl as "" for all entries.)'

  const prompt = `You are an expert data extractor. Extract contact persons' names from the text below.
${urlSection}

STRICT RULES:
1. Extract only real people's names (not company names).
2. For linkedinUrl: ONLY assign a URL from the AVAILABLE LINKEDIN URLS list above. Match by trying to find the person's name in the URL slug. If you cannot confidently match, output "".
3. NEVER output the same person twice.
4. NEVER invent or guess a LinkedIn URL. Only use URLs explicitly listed above.

Text:
"""
${text}
"""

Return ONLY a valid JSON array, no markdown:
[
  {
    "name": "Full Name",
    "linkedinUrl": "https://www.linkedin.com/in/..."
  }
]`

  let fullText = ''
  try {
    const stream = await client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1200,
      extra_body: model === 'nvidia/nemotron-3-nano-30b-a3b' ? {
        reasoning_budget: 2048,
        chat_template_kwargs: { enable_thinking: false }
      } : undefined,
      stream: true
    })

    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue
      const delta = chunk.choices[0].delta
      if (delta?.content) fullText += delta.content
    }
  } catch (e) {
    console.error('Contact Extract Error:', e.message)
    return { name: '', linkedinUrl: '' }
  }

  const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullText.match(/(\[[\s\S]*\]?)/)
  let jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : fullText.trim()

  // Auto-repair cut-off JSON array
  jsonStr = jsonStr.trim()
  if (jsonStr.startsWith('[')) {
    jsonStr = jsonStr.replace(/,\s*$/, '') // remove trailing trailing comma
    if (!jsonStr.endsWith(']')) {
      // Try to close an open object and close array
      if (!jsonStr.endsWith('}')) jsonStr += '"}'
      jsonStr += ']'
    }
  }

  try {
    const data = JSON.parse(jsonStr)
    const seenNames = new Set()

    const sanitize = (rawUrl) => {
      const validated = validateLinkedInUrl(rawUrl || '')
      // Whitelist check: if we have real URLs from the DOM, the LLM's answer must be in that list
      if (validated && hasRealUrls) {
        const matches = realLinkedInUrls.some(real =>
          real.toLowerCase().replace(/\/$/, '') === validated.toLowerCase().replace(/\/$/, '')
        )
        return matches ? validated : '' // wipe if not in whitelist
      }
      return validated
    }

    if (Array.isArray(data)) {
      return data.map(d => ({
        name: d.name || '',
        linkedinUrl: sanitize(d.linkedinUrl)
      })).filter(d => {
        if (!d.name && !d.linkedinUrl) return false
        if (seenNames.has(d.name)) return false
        seenNames.add(d.name)
        return true
      })
    } else if (data && (data.name || data.linkedinUrl)) {
      return [{ name: data.name || '', linkedinUrl: sanitize(data.linkedinUrl) }]
    }
    return []
  } catch {
    console.error('Failed to parse Contact Extract JSON:', fullText)
    return []
  }
}

/**
 * Strips common legal/subsidiary suffixes from a company name for fuzzy matching.
 * e.g. "Nvidia Graphics Pvt Ltd" → "nvidia"
 */
export function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|incorporated|corp\.?|corporation|llp|llc|l\.l\.c\.?|l\.l\.p\.?|co\.\s*ltd\.?|group|holdings|enterprises|solutions|technologies|graphics|systems|industries|services|international|india|global)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Uses AI to convert formal MCA/registration company names to their LinkedIn brand names.
 * e.g. "Nvidia Graphics India Pvt Ltd" → "NVIDIA"
 * Falls back to normalizeCompanyName if AI is unavailable.
 */
export async function resolveLinkedInCompanyName(formalName) {
  if (!formalName) return formalName

  // Quick passthrough for names that are already short / don't have legal suffixes
  const stripped = normalizeCompanyName(formalName)
  const hasLegalSuffix = /\b(pvt|ltd|private|limited|llp|llc|inc|corp|incorporated)\b/i.test(formalName)
  if (!hasLegalSuffix && formalName.split(' ').length <= 2) return formalName

  try {
    const { client, model } = getClient()
    const prompt = `You are a business intelligence assistant. Given a formal company registration name, return the common brand name that would appear on LinkedIn.

Examples:
- "Nvidia Graphics India Pvt Ltd" → "NVIDIA"
- "Tata Consultancy Services Limited" → "Tata Consultancy Services"
- "Hindustan Unilever Limited" → "Hindustan Unilever"
- "Apple India Private Limited" → "Apple"
- "Maruti Suzuki India Limited" → "Maruti Suzuki"
- "3M India Limited" → "3M"

Rules:
- Return the commonly known brand / LinkedIn company name
- Remove legal suffixes (Pvt Ltd, Limited, Inc, Corp, etc.)
- Remove country/region qualifiers if the brand is global (e.g. remove "India")
- Keep subsidiary identifiers if meaningful (e.g. keep "India" for Hindustan Unilever)
- Return only the company name string, no explanation

Formal name: "${formalName}"

Return ONLY a valid JSON: { "linkedinName": "Brand Name" }`

    let fullText = ''
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 60,
      stream: true
    })
    for await (const chunk of stream) {
      if (!chunk.choices?.length) continue
      const delta = chunk.choices[0].delta
      if (delta?.content) fullText += delta.content
    }

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || fullText.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : fullText.trim()
    const data = JSON.parse(jsonStr)
    if (data.linkedinName && typeof data.linkedinName === 'string') {
      return data.linkedinName.trim()
    }
  } catch (e) {
    console.warn(`resolveLinkedInCompanyName failed for "${formalName}":`, e.message)
  }

  // Fallback: uppercase-first stripped name
  return stripped.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Extracts domain-specific keywords from a job title string, removing generic role words.
 * e.g. "EHS head, environmental health and safety officer" → "ehs environmental health safety"
 */
export function extractJobDomainKeywords(jobTitles) {
  const stopWords = new Set([
    'head', 'officer', 'manager', 'director', 'chief', 'senior', 'junior',
    'lead', 'associate', 'assistant', 'vp', 'vice', 'president', 'of', 'the',
    'and', 'in', 'at', 'for', 'a', 'an', 'general', 'executive', 'deputy'
  ])
  return [...new Set(
    jobTitles
      .toLowerCase()
      .split(/[\s,\/\-&()+]+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  )].slice(0, 5).join(' ')
}

/**
 * Verifies that a contact lead's text result actually mentions the target company
 * and a relevant job title domain keyword — with fuzzy/partial matching.
 *
 * "Nvidia Graphics Pvt Ltd" will match "nvidia" in text.
 * "EHS officer" will match when searching for "EHS head" (shared domain keyword "ehs").
 */
export function verifyLeadMatch(text, companyName, jobTitles) {
  if (!text) return false
  const t = text.toLowerCase()

  // Company: normalize and check if any core word appears in text
  const companyCore = normalizeCompanyName(companyName)
  const companyWords = companyCore.split(/\s+/).filter(w => w.length > 2)
  const companyMatch = companyWords.length === 0 || companyWords.some(w => t.includes(w))

  // Job title: check if any domain keyword appears in text
  const jobKeywords = extractJobDomainKeywords(jobTitles)
  const jobWords = jobKeywords.split(/\s+/).filter(w => w.length > 2)
  const jobMatch = jobWords.length === 0 || jobWords.some(w => t.includes(w))

  return companyMatch && jobMatch
}
