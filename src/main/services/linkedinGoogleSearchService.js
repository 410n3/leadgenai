// LinkedIn profile finder using Google X-Ray search (site:linkedin.com/in/)
// Same approach as recruitmentgeek.com/tools/linkedin — uses Google to search
// public LinkedIn profile pages without any paid API.

import { chromium } from 'playwright'

const DELAY_BETWEEN_SEARCHES_MS = 2500

function buildGoogleQuery(jobTitles, companyName, location) {
  // Proven format: ehs "at microsoft" ",karnataka" site:linkedin.com/in/
  //
  // "at [company]"  — phrase matches profile titles like "EHS Manager at Microsoft"
  // ",[location]"   — comma prefix matches LinkedIn's location field format
  //                   e.g. "Bengaluru, Karnataka, India" → won't match skill mentions
  const parts = []

  // Job title keywords unquoted — broader matching
  if (jobTitles.length === 1) {
    parts.push(jobTitles[0])
  } else if (jobTitles.length > 1) {
    parts.push(`(${jobTitles.join(' OR ')})`)
  }

  // Quoted "at Company" phrase
  parts.push(`"at ${companyName}"`)

  // Comma-prefixed location — targets the LinkedIn location field specifically
  if (location) parts.push(`",${location}"`)

  parts.push('site:linkedin.com/in/')

  return parts.join(' ')
}

function parseLinkedInTitle(rawTitle) {
  // Google shows LinkedIn profile titles like:
  //   "John Doe - EHS Manager at Nvidia | LinkedIn"
  //   "Jane Smith - Head of EHS - Bengaluru, India | LinkedIn"
  const clean = rawTitle.replace(/\s*[|–]\s*LinkedIn\s*$/i, '').trim()
  const dashIdx = clean.indexOf(' - ')
  if (dashIdx === -1) return { name: clean, jobTitle: '' }
  return {
    name: clean.slice(0, dashIdx).trim(),
    jobTitle: clean.slice(dashIdx + 3).trim()
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// searchInputs: [{ company, jobTitles: string[], location: string, maxResults: number }]
// Returns: [{ company, profiles: [{ name, title, linkedinUrl, location, company, verified }] }]
export async function searchLinkedInProfiles(searchInputs, onProgress) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US'
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
  })

  const page = await context.newPage()
  const allResults = []

  try {
    for (let i = 0; i < searchInputs.length; i++) {
      const { company, jobTitles, location, maxResults = 5 } = searchInputs[i]
      const query = buildGoogleQuery(jobTitles, company, location)

      onProgress(`[${i + 1}/${searchInputs.length}] Google search: ${company}`)

      try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en&gl=in`
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await sleep(1200)

        // Detect CAPTCHA / rate limit
        const pageText = await page.evaluate(() => document.body?.innerText || '')
        if (/unusual traffic|captcha|verify you are human/i.test(pageText)) {
          onProgress(`Google rate limit for ${company} — skipping`)
          allResults.push({ company, profiles: [] })
          await sleep(5000)
          continue
        }

        // Extract LinkedIn profile links from Google results
        const profiles = await page.evaluate((maxR) => {
          const seen = new Set()
          const items = []
          const anchors = Array.from(document.querySelectorAll('a'))
          for (const a of anchors) {
            const href = (a.href || '').split('?')[0]
            if (!href.includes('linkedin.com/in/')) continue
            if (seen.has(href)) continue
            seen.add(href)

            // Find the h3 result title nearest to this anchor
            let titleEl = a.querySelector('h3')
            if (!titleEl) {
              const container = a.closest('[data-ved]') || a.parentElement?.parentElement
              titleEl = container?.querySelector('h3')
            }
            const title = titleEl?.innerText?.trim() || ''
            if (title) {
              items.push({ url: href, title })
              if (items.length >= maxR) break
            }
          }
          return items
        }, maxResults)

        const parsed = profiles
          .map(r => {
            const { name, jobTitle } = parseLinkedInTitle(r.title)
            return {
              name,
              title: jobTitle,
              linkedinUrl: r.url,
              location: location || '',
              company,
              verified: true
            }
          })
          .filter(p => p.name && p.linkedinUrl)

        onProgress(`Found ${parsed.length} profiles for ${company}`)
        allResults.push({ company, profiles: parsed })
      } catch (err) {
        onProgress(`Search error for ${company}: ${err.message}`)
        allResults.push({ company, profiles: [] })
      }

      if (i < searchInputs.length - 1) {
        await sleep(DELAY_BETWEEN_SEARCHES_MS)
      }
    }
  } finally {
    await browser.close().catch(() => {})
  }

  return allResults
}
