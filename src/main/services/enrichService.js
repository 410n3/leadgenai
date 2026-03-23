import OpenAI from 'openai'
import { chromium } from 'playwright'
import { solve } from 'recaptcha-solver'
import { injectPippurOverlay } from './browserOverlay.js'
import { extractRevenueWithQA } from './nlpService.js'

const NAV_TIMEOUT = 20000

// Search results columns: [0]=CIN, [1]=Name (link), [2]=Address
// Detail page: has Authorized Capital and Paid-up Capital

// Strip Google Maps branch/location suffixes before MCA search
// e.g. "SAP Labs India - Whitefield (Main Entrance)" → "SAP Labs India"
// e.g. "Infosys BPM (Block 1, Electronic City)" → "Infosys BPM"
function cleanNameForSearch(name) {
  return (name || '')
    .replace(/\s*[-–—]\s*.+$/, '')           // remove "- Whitefield ..." suffix
    .replace(/\s*\([^)]*\)/g, '')             // remove "(anything)"
    .replace(/\s*(branch|office|outlet|store|centre|center|campus|hub|unit|annexe|annex|wing|tower|block|plot|floor)\b.*/i, '')
    .trim()
    .split(/\s+/).slice(0, 5).join(' ')       // max 5 words
}

function normalizeName(n) {
  return (n || '').toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|llp|inc|co|and|&)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function parseCapital(str) {
  if (!str) return null
  // Keep digits and decimal point only (strip ₹, commas, spaces, "Lakhs", etc.)
  const cleaned = str.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const val = parseFloat(cleaned)
  return isNaN(val) ? null : Math.round(val)
}

function fmtCap(rupees) {
  if (rupees == null) return 'N/A'
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)} Cr`
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)} L`
  return `₹${rupees.toLocaleString('en-IN')}`
}

// Parse revenue text strings like "₹500 Cr", "Rs 200 crore", "₹50 lakh", "$10 million", etc.
function parseRevenueText(text) {
  if (!text) return null
  const t = text.toLowerCase().replace(/,/g, '').replace(/\s+/g, ' ')
  const isDollar = /\$|usd/.test(t)

  // Ordered from longest to shortest to avoid partial matches (e.g. "cr" before "crore")
  const UNIT_RE = /(\d+(?:\.\d+)?)\s*(crores?|crore|cr\b|lakhs?|lakh|lacs?|lac\b|billions?|bn\b|millions?|mn\b|thousands?|k\b)/i
  const m = t.match(UNIT_RE)
  if (!m) return null

  const num = parseFloat(m[1])
  const unit = m[2].toLowerCase()

  if (unit.startsWith('cr')) return Math.round(num * 10_000_000)
  if (unit.startsWith('lakh') || unit.startsWith('lac')) return Math.round(num * 100_000)
  if (unit.startsWith('billion') || unit === 'bn') return Math.round(num * (isDollar ? 83_000_000_000 : 1_000_000_000))
  if (unit.startsWith('million') || unit === 'mn') return Math.round(num * (isDollar ? 83_000_000 : 1_000_000))
  if (unit.startsWith('thousand') || unit === 'k') return Math.round(num * (isDollar ? 83_000 : 1_000))
  return null
}

// Extract last meaningful city word from an address string (strips pincodes)
function extractCity(address) {
  if (!address) return ''
  const cleaned = address.replace(/\b\d{6}\b/g, '').trim()
  const words = cleaned.split(/[\s,]+/).filter(w => w.length > 2)
  return words[words.length - 1] || ''
}

// ── NVIDIA client (reuses same key as nlpService) ─────────────────────────────
function getNvidiaClient() {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return null
  return new OpenAI({ baseURL: 'https://integrate.api.nvidia.com/v1', apiKey })
}

// Ask the NVIDIA model to extract 2-3 canonical MCA search name candidates
// e.g. "XYZ Logistics Warehouse - Whitefield (Main Entrance)"
//   → ["XYZ Logistics Private Limited", "XYZ Logistics", "XYZ"]
async function getCanonicalNames(rawName, address, log) {
  const client = getNvidiaClient()
  if (!client) return [cleanNameForSearch(rawName)]

  try {
    let text = ''
    const stream = await client.chat.completions.create({
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      messages: [{
        role: 'user',
        content: `Extract MCA-registered company name search candidates from this Google Maps business entry.

Business: "${rawName}"
Address: "${address}"

Return ONLY valid JSON (no markdown, no explanation):
{"candidates":["Full Official Name Pvt Ltd","Core Name","Shortest Form"]}

Rules:
- Strip location/branch info (Whitefield, Electronic City, Warehouse, Main Entrance, Branch, etc.)
- Keep legal entity suffix (Pvt Ltd, LLP, Ltd) in the first candidate if it likely applies
- Generate 2-3 candidates from longest to shortest
- Each should be a plausible MCA filing name`
      }],
      temperature: 0.1,
      max_tokens: 200,
      stream: true,
      extra_body: { reasoning_budget: 512, chat_template_kwargs: { enable_thinking: false } }
    })

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta
      if (delta?.content) text += delta.content
    }

    const m = text.match(/\{[\s\S]*?\}/)
    if (m) {
      const parsed = JSON.parse(m[0])
      if (Array.isArray(parsed.candidates)) {
        const valid = parsed.candidates.map(s => (s || '').trim()).filter(s => s.length > 1)
        if (valid.length > 0) {
          log(`  AI candidates: [${valid.join(' | ')}]`)
          return valid
        }
      }
    }
  } catch (err) {
    log(`  AI: fallback (${err.message.slice(0, 50)})`)
  }

  return [cleanNameForSearch(rawName)]
}

// Confidence score 0-100: name similarity (0-60) + address overlap (0-40)
function calcConfidence(searchName, resultName, searchAddr, resultAddr) {
  const a = normalizeName(searchName)
  const b = normalizeName(resultName)

  let nameScore = 0
  if (a && b) {
    if (a === b) {
      nameScore = 60
    } else if (b.includes(a) || a.includes(b)) {
      nameScore = 50
    } else {
      const aWords = a.split(' ').filter(w => w.length >= 4)
      const bWords = b.split(' ').filter(w => w.length >= 4)
      if (aWords.length > 0) {
        const matched = aWords.filter(aw => bWords.some(bw => bw.startsWith(aw) || aw.startsWith(bw)))
        nameScore = Math.round(40 * matched.length / aWords.length)
      }
    }
  }

  let addrScore = 0
  if (searchAddr && resultAddr) {
    const sA = searchAddr.toLowerCase()
    const rA = resultAddr.toLowerCase()
    // Pincode exact match is a very strong location signal
    const sPin = sA.match(/\b\d{6}\b/)
    const rPin = rA.match(/\b\d{6}\b/)
    if (sPin && rPin && sPin[0] === rPin[0]) addrScore += 25
    // Significant word overlap (city, state, area names)
    const sWords = sA.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 5)
    const rWords = new Set(rA.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 5))
    const wordMatches = sWords.filter(w => rWords.has(w)).length
    addrScore += Math.min(wordMatches * 10, 15)
    addrScore = Math.min(addrScore, 40)
  }

  return Math.min(nameScore + addrScore, 100)
}

// Match if first significant word (4+ chars) from search appears in result
function fuzzyMatch(searchName, resultName) {
  const a = normalizeName(searchName)
  const b = normalizeName(resultName)
  if (!a || !b) return false
  if (b.includes(a) || a.includes(b)) return true
  const aWords = a.split(' ').filter(w => w.length >= 4)
  if (aWords.length === 0) return false
  const firstWord = aWords[0]
  return b.split(' ').some(bw => bw.startsWith(firstWord) || firstWord.startsWith(bw))
}

function isErrorPage(text) {
  return text.includes('An error occurred while processing') ||
    text.includes('info@zaubacorp.com') ||
    text.includes('Please try again')
}

function hasCaptcha(text) {
  const t = text.toLowerCase()
  return t.includes('captcha') ||
    t.includes('are you a robot') ||
    t.includes('verify you are human') ||
    t.includes('i am not a robot') ||
    t.includes('cloudflare') ||
    t.includes('checking your browser')
}

// Manual-only CAPTCHA wait (checkbox auto-click is unreliable — user must click)
async function waitForCaptchaSolve(page, onCaptcha, log) {
  log('  🔒 CAPTCHA detected — please click the checkbox in the browser window')
  onCaptcha(true)
  for (let i = 0; i < 90; i++) {
    await safeWait(page, 2000)
    if (page.isClosed()) { onCaptcha(false); return false }
    const text = await page.evaluate(() => document.body.innerText).catch(() => '')
    if (!hasCaptcha(text)) {
      onCaptcha(false)
      return true
    }
  }
  onCaptcha(false)
  return false
}

// Safe wait — never throws even if page is closed
async function safeWait(page, ms) {
  try { if (!page.isClosed()) await page.waitForTimeout(ms) } catch (_) { }
}

async function rnd(page, lo = 1000, hi = 2000) {
  await safeWait(page, lo + Math.random() * (hi - lo))
}

// Safe goto: returns false if navigation fails (500, network error, page closed, etc.)
async function safeGoto(page, url, log) {
  try {
    if (page.isClosed()) return false
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
    if (resp && resp.status() >= 500) {
      log(`  HTTP ${resp.status()} — Zauba Corp unavailable`)
      return false
    }
    return true
  } catch (err) {
    log(`  Nav error: ${err.message.split('\n')[0]}`)
    return false
  }
}

// Update the Pippur banner status in the browser overlay
async function setBannerStatus(page, text) {
  if (!page || page.isClosed()) return
  await page.evaluate((t) => {
    if (window.__pippurSetStatus) window.__pippurSetStatus(t)
  }, text).catch(() => { })
}

// Known search input selectors on Zauba Corp homepage
const SEARCH_SELECTORS = [
  'input[name="company"]',
  'input#company',
  'input[id*="company" i]',
  'input[placeholder*="company" i]',
  'input[placeholder*="search" i]',
  'form input[type="text"]'
]

// Autocomplete dropdown selectors (jQuery UI, typeahead, etc.)
const AUTOCOMPLETE_SELECTORS = [
  '.ui-autocomplete li.ui-menu-item',
  'ul.ui-autocomplete li',
  '.autocomplete-suggestions .autocomplete-suggestion',
  '[role="listbox"] [role="option"]',
  '.tt-menu .tt-suggestion',
  '.dropdown-menu li a'
]

async function findSearchInput(page) {
  for (const sel of SEARCH_SELECTORS) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) return el
  }
  return null
}

// Returns { ok, autocomplete, autoConf, autoText }
async function goSearch(page, name, log) {
  if (page.isClosed()) return { ok: false }

  // If we're not on the homepage (e.g. on a results page), go back first
  const currentUrl = page.url()
  if (!currentUrl.includes('zaubacorp.com') || currentUrl.includes('company-list') || currentUrl.includes('companies-list')) {
    const homeOk = await safeGoto(page, 'https://www.zaubacorp.com', log)
    if (!homeOk || page.isClosed()) return { ok: false }
    await safeWait(page, 1500)
  }

  // Use the search form
  let inp = await findSearchInput(page)

  // If not found on current page, try going to homepage explicitly
  if (!inp) {
    log('  Search input not found — reloading homepage')
    const ok = await safeGoto(page, 'https://www.zaubacorp.com', log)
    if (!ok || page.isClosed()) return { ok: false }
    await safeWait(page, 2000)
    inp = await findSearchInput(page)
  }

  if (!inp) {
    log('  ✗ Could not find search input on Zauba Corp')
    return { ok: false }
  }

  try {
    await inp.click()
    await inp.fill('')

    // Type slowly to trigger autocomplete suggestions
    await setBannerStatus(page, `Typing: ${name}...`)
    await page.keyboard.type(name, { delay: 80 })

    // Wait for autocomplete dropdown to appear
    await safeWait(page, 1800)

    // Collect all visible suggestions
    const suggestions = []
    for (const sel of AUTOCOMPLETE_SELECTORS) {
      const items = page.locator(sel)
      const count = await items.count().catch(() => 0)
      if (count > 0) {
        for (let i = 0; i < Math.min(count, 8); i++) {
          const text = await items.nth(i).innerText().catch(() => '')
          if (text.trim()) suggestions.push({ text: text.trim(), locator: items.nth(i) })
        }
        if (suggestions.length > 0) break
      }
    }

    if (suggestions.length > 0) {
      log(`  Autocomplete: ${suggestions.length} suggestions`)
      // Score each suggestion by name similarity
      let best = { text: '', locator: null, conf: 0 }
      for (const s of suggestions) {
        const conf = calcConfidence(name, s.text, '', '')
        log(`  → "${s.text.slice(0, 40)}" | ${conf}%`)
        if (conf > best.conf) best = { ...s, conf }
      }

      if (best.conf >= 30 && best.locator) {
        await setBannerStatus(page, `Selecting: ${best.text.slice(0, 40)} (${best.conf}%)`)
        log(`  ✓ Selecting: "${best.text}" @ ${best.conf}%`)
        await best.locator.click()
        await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT }).catch(() => { })
        await safeWait(page, 1500)
        return { ok: !page.isClosed(), autocomplete: true, autoConf: best.conf, autoText: best.text }
      }
    }

    // Fall back to pressing Enter (search results page)
    await setBannerStatus(page, `Searching: ${name}`)
    await page.keyboard.press('Enter')
    await page.waitForLoadState('domcontentloaded', { timeout: NAV_TIMEOUT }).catch(() => { })
    await safeWait(page, 2000)
    log(`  Searched: "${name}"`)
    return { ok: !page.isClosed(), autocomplete: false }
  } catch (err) {
    log(`  Form submit error: ${err.message.split('\n')[0]}`)
    return { ok: false }
  }
}

function isGoogleBlocked(url, bodyText) {
  if (url.includes('/sorry/') || url.includes('google.com/sorry')) return true
  const t = bodyText.toLowerCase()
  return t.includes('unusual traffic') ||
    t.includes('are you a robot') ||
    t.includes('verify you are human') ||
    t.includes('i am not a robot') ||
    t.includes('before you continue') ||
    t.includes('captcha')
}

async function googleRevenueLookup(gPage, cName, address, log, onCaptcha) {
  if (!gPage || gPage.isClosed()) return null
  try {
    const searchLocation = extractCity(address)
    // The prompt must encourage the word "revenue" in the output so fallback regexes (REV.test) don't fail!
    const qStr = `What is the annual revenue or turnover of ${cName} ${searchLocation}? State the word "revenue" in your answer and give the amount in Rs Crore.`
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(qStr)}&hl=en`
    await setBannerStatus(gPage, `Google: ${cName}`)
    log(`  Google: "${qStr}"`)
    const ok = await safeGoto(gPage, searchUrl, log)
    if (!ok || gPage.isClosed()) return null
    await safeWait(gPage, 2000)

    // Check for CAPTCHA / block — wait for manual solve then retry
    let bodyText = await gPage.evaluate(() => document.body.innerText).catch(() => '')
    if (isGoogleBlocked(gPage.url(), bodyText)) {
      log('  Google: CAPTCHA/block detected — waiting for solve...')
      const solved = await waitForCaptchaSolve(gPage, onCaptcha, log)
      if (!solved || gPage.isClosed()) {
        log('  Google: CAPTCHA not solved — skipping')
        return null
      }
      // Re-navigate after solve
      const retryOk = await safeGoto(gPage, searchUrl, log)
      if (!retryOk || gPage.isClosed()) return null
      await safeWait(gPage, 2000)
      bodyText = await gPage.evaluate(() => document.body.innerText).catch(() => '')
      if (isGoogleBlocked(gPage.url(), bodyText)) {
        log('  Google: still blocked after solve — skipping')
        return null
      }
    }

    // Click "AI Mode" button if visible
    const aiTabClicked = await gPage.evaluate(() => {
      const els = [
        ...document.querySelectorAll('button'),
        ...document.querySelectorAll('span'),
        ...document.querySelectorAll('div[role="button"]'),
        ...document.querySelectorAll('a')
      ]
      for (const el of els) {
        const txt = (el.textContent || '').trim()
        if ((txt === 'AI' || txt === 'AI Mode') && el.offsetParent !== null) { el.click(); return true }
      }
      return false
    }).catch(() => false)

    if (aiTabClicked) {
      log('  Google: clicked AI Mode — waiting for response stream...')
      await gPage.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => { })
    }

    // Always wait at least 6 seconds so the Google AI has time to finish generating the text
    await safeWait(gPage, 6000)

    // Re-check for CAPTCHA after AI Mode navigation/stream
    const afterUrl = gPage.url()
    const afterText = await gPage.evaluate(() => document.body.innerText).catch(() => '')
    if (isGoogleBlocked(afterUrl, afterText)) {
      log('  Google: CAPTCHA after AI Mode — skipping')
      return null
    }

    const rawText = await gPage.evaluate(() => {
      const REV = /(?:revenue|turnover|annual|sales)/i
      const AMT = /(?:₹|crore|lakh|cr\b|rs\b|inr\b|\$|billion|million|mn\b|bn\b)/i

      // Priority 1: AI Overview / AI Mode wrapper
      const aiBox = document.querySelector('.LzLJgf, [data-response-type], .AIzFyb, [jsname="yEVEwb"]')
      if (aiBox && aiBox.innerText.trim().length > 20) {
        return aiBox.innerText.trim()
      }

      // Priority 2: Knowledge Graph / Panel
      for (const sel of ['[data-attrid*="revenue"]', '[data-attrid*="annual"]', '[data-attrid*="turnover"]', '.kp-blk', '.kno-rdesc']) {
        const el = document.querySelector(sel)
        if (el && AMT.test(el.innerText)) return el.innerText.trim()
      }

      // Priority 3: Full search results block (first ~4000 characters)
      const searchBox = document.querySelector('#search')
      if (searchBox && searchBox.innerText.trim().length > 20) {
        return searchBox.innerText.trim().slice(0, 4000)
      }

      // Ultimate Fallback: Just take the whole page text
      return document.body.innerText.trim().slice(0, 4000)
    }).catch(() => null)

    if (!rawText) {
      log('  Google: no revenue found')
      return null
    }

    // Try standard regex parse first
    let finalStr = rawText
    let revenueRupees = parseRevenueText(rawText)

    // Fallback securely to our robust Local QA MiniLM model to pluck the exact phrase natively
    if (!revenueRupees && rawText.length > 25) {
      const aiExtracted = await extractRevenueWithQA(rawText)
      if (aiExtracted) {
        finalStr = aiExtracted
        revenueRupees = parseRevenueText(aiExtracted)
      }
    }

    if (!revenueRupees) {
      log(`  Google: unparseable — "${rawText.slice(0, 60)}"`)
      return null
    }

    return { revenueRupees, rawText: finalStr }
  } catch (err) {
    log(`  Google: error — ${err.message.slice(0, 60)}`)
    return null
  }
}

async function enrichLead(page, gPage, lead, log, onCaptcha) {
  const rawName = lead.name || ''
  const address = lead.fullAddress || lead.address || ''
  if (!rawName.trim()) return { ...lead, mcaData: { mcaFound: false } }

  // Priority 1: Google revenue lookup
  const gResult = await googleRevenueLookup(gPage, rawName, address, log, onCaptcha)
  if (gResult) {
    log(`  Google: ${fmtCap(gResult.revenueRupees)} — "${gResult.rawText.slice(0, 60)}"`)
    return { ...lead, mcaData: { mcaFound: false, googleRevenue: gResult.revenueRupees, revenueSource: 'google' } }
  }

  // Priority 2: MCA / Zauba Corp
  // AI: get canonical search name candidates (longest → shortest)
  const candidates = await getCanonicalNames(rawName, address, log)

  let best = null  // { cinText, nameText, href, confidence }

  try {
    for (let ci = 0; ci < candidates.length; ci++) {
      const name = candidates[ci].trim()
      if (!name) continue
      // Skip duplicate candidates (after normalization)
      if (ci > 0 && normalizeName(name) === normalizeName(candidates[ci - 1])) continue

      const sr = await goSearch(page, name, log)
      if (!sr.ok) return { ...lead, mcaData: { mcaFound: false, _navError: true } }

      // If autocomplete took us directly to a company detail page — skip row scanning
      if (sr.autocomplete) {
        const curUrl = page.url()
        if (/\/company\/[^/]+\/[A-Z]/.test(curUrl)) {
          log(`  ✓ Autocomplete landed on detail page (${sr.autoConf}%)`)
          best = { nameText: sr.autoText, cinText: '', href: curUrl, confidence: sr.autoConf, onDetailPage: true }
          break
        }
      }

      let bodyText = await page.evaluate(() => document.body.innerText).catch(() => '')

      if (hasCaptcha(bodyText)) {
        log('  🔒 CAPTCHA — trying auto-solve...')
        const solved = await waitForCaptchaSolve(page, onCaptcha, log)
        if (!solved) { log('  ✗ CAPTCHA timeout — skipping'); return { ...lead, mcaData: { mcaFound: false } } }
        bodyText = await page.evaluate(() => document.body.innerText).catch(() => '')
      }

      if (isErrorPage(bodyText)) {
        log(`  ⚠ Error page — backing off 6s...`)
        await safeWait(page, 6000)
        const homeOk = await safeGoto(page, 'https://www.zaubacorp.com', log)
        if (!homeOk) return { ...lead, mcaData: { mcaFound: false, _navError: true } }
        await rnd(page, 3000, 4500)
        const retrySr = await goSearch(page, name, log)
        if (!retrySr.ok) return { ...lead, mcaData: { mcaFound: false, _navError: true } }
        const retryBody = await page.evaluate(() => document.body.innerText).catch(() => '')
        if (hasCaptcha(retryBody)) {
          log('  🔒 CAPTCHA on retry — trying auto-solve...')
          await waitForCaptchaSolve(page, onCaptcha, log)
        }
        const finalBody = await page.evaluate(() => document.body.innerText).catch(() => '')
        if (isErrorPage(finalBody)) { log(`  ✗ Still blocked`); return { ...lead, mcaData: { mcaFound: false } } }
      }

      // Score every result row: name similarity + address overlap
      const rows = await page.$$('table tbody tr, table tr')
      log(`  [${name}] ${rows.length} rows`)

      if (rows.length === 0) {
        const title = await page.title().catch(() => '')
        log(`  Page: "${title}" | ${page.url().slice(0, 70)}`)
      }

      for (const row of rows) {
        const cells = await row.$$('td')
        if (cells.length < 2) continue
        const cinText = (await cells[0].innerText().catch(() => '')).trim()
        const nameText = (await cells[1].innerText().catch(() => '')).trim()
        const resAddr = cells.length > 2 ? (await cells[2].innerText().catch(() => '')).trim() : ''
        const link = await cells[1].$('a')
        const href = link ? (await link.getAttribute('href').catch(() => '')) || '' : ''

        const conf = calcConfidence(name, nameText, address, resAddr)
        log(`  "${nameText.slice(0, 38)}" | addr:"${resAddr.slice(0, 22)}" | ${conf}%`)

        if (conf > (best?.confidence ?? 0)) best = { cinText, nameText, href, confidence: conf }
      }

      // If we already have a strong match, no need to try shorter candidates
      if (best && best.confidence >= 65) break
    }
  } catch (err) {
    log(`  ✗ Exception: ${err.message}`)
    return { ...lead, mcaData: { mcaFound: false, _navError: true } }
  }

  if (!best || best.confidence < 25) {
    log(`  No match (best: ${best?.confidence ?? 0}%)`)
    return { ...lead, mcaData: { mcaFound: false } }
  }

  log(`  → Best: "${best.nameText}" @ ${best.confidence}% confidence`)

  // Navigate to company detail page (skip if autocomplete already landed here)
  if (!best.onDetailPage) {
    const detailUrl = best.href
      ? (best.href.startsWith('http') ? best.href : `https://www.zaubacorp.com${best.href}`)
      : `https://www.zaubacorp.com/company/X/${best.cinText}`

    log(`  → Detail: ${detailUrl.slice(0, 80)}`)
    const detailOk = await safeGoto(page, detailUrl, log)
    await rnd(page, 1500, 2500)

    if (!detailOk) {
      log(`  ✗ Detail page failed — using CIN only`)
      return { ...lead, mcaData: { mcaFound: true, confidence: best.confidence, cinNumber: best.cinText, paidUpCapital: null, authorizedCapital: null, status: 'Active' } }
    }
  }

  let detailBody = await page.evaluate(() => document.body.innerText).catch(() => '')
  if (hasCaptcha(detailBody)) {
    log('  🔒 CAPTCHA on detail — trying auto-solve...')
    await waitForCaptchaSolve(page, onCaptcha, log)
    detailBody = await page.evaluate(() => document.body.innerText).catch(() => '')
  }
  if (isErrorPage(detailBody)) {
    log(`  ✗ Error on detail page — using CIN only`)
    return { ...lead, mcaData: { mcaFound: true, confidence: best.confidence, cinNumber: best.cinText, paidUpCapital: null, authorizedCapital: null, status: 'Active' } }
  }

  // Extract capital data from detail page
  const mcaData = await page.evaluate(() => {
    const result = {}
    const allText = document.body.innerText
    const cinM = allText.match(/\b([A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/)
    if (cinM) result.cinNumber = cinM[1]

    const scanPair = (label, val) => {
      const l = label.toLowerCase().replace(/\s+/g, ' ').trim()
      const v = val.trim()
      if (!v) return
      if (l.includes('cin') && !result.cinNumber) result.cinNumber = v
      if ((l === 'status' || l === 'company status') && !result.status) result.status = v
      if (l.includes('incorporation') && !result.incorporationDate) result.incorporationDate = v
      if (l.includes('authorized capital') && !result.authorizedCapitalStr) result.authorizedCapitalStr = v
      if ((l.includes('paid up') || l.includes('paid-up')) && !result.paidUpCapitalStr) result.paidUpCapitalStr = v
    }

    document.querySelectorAll('dt').forEach(dt => scanPair(dt.innerText, dt.nextElementSibling?.innerText || ''))
    document.querySelectorAll('th').forEach(th => scanPair(th.innerText, th.nextElementSibling?.innerText || ''))
    document.querySelectorAll('tr').forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td'))
      if (tds.length >= 2) scanPair(tds[0].innerText, tds[1].innerText)
    })
    return result
  })

  log(`  CIN: ${mcaData.cinNumber || best.cinText} | Auth: ${mcaData.authorizedCapitalStr || '?'} | Paid-up: ${mcaData.paidUpCapitalStr || '?'}`)

  return {
    ...lead,
    mcaData: {
      mcaFound: true,
      confidence: best.confidence,
      cinNumber: mcaData.cinNumber || best.cinText || null,
      status: mcaData.status || 'Active',
      incorporationDate: mcaData.incorporationDate || null,
      authorizedCapital: parseCapital(mcaData.authorizedCapitalStr),
      paidUpCapital: parseCapital(mcaData.paidUpCapitalStr)
    }
  }
}

export async function enrichLeads(leads, onProgress, onCaptcha = () => { }) {
  if (!leads || leads.length === 0) return leads

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-infobars']
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata'
  })

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  await injectPippurOverlay(context)

  const page = await context.newPage()
  const gPage = await context.newPage()
  const enriched = []
  let found = 0

  const unenriched = (from) => from.map(l => ({ ...l, mcaData: { mcaFound: false } }))
  const emit = (msg, cur) => onProgress({ current: cur ?? 0, total: leads.length, status: msg, found, log: msg })

  try {
    emit('Visiting Zauba Corp to establish session...')
    const homeOk = await safeGoto(page, 'https://www.zaubacorp.com', (m) => emit(m))
    if (!homeOk || page.isClosed()) {
      emit('⚠ Zauba Corp unavailable — skipping MCA enrichment')
      return unenriched(leads)
    }
    await safeWait(page, 2500)

    let consecutiveErrors = 0

    for (let i = 0; i < leads.length; i++) {
      // Abort if page died or too many consecutive failures
      if (page.isClosed()) {
        emit(`⚠ Browser closed unexpectedly — stopping at lead ${i + 1}`, i)
        enriched.push(...unenriched(leads.slice(i)))
        break
      }
      if (consecutiveErrors >= 3) {
        emit('⚠ Too many errors — Zauba Corp appears down, stopping enrichment', i)
        enriched.push(...unenriched(leads.slice(i)))
        break
      }

      const lead = leads[i]
      const logLines = []
      const log = (msg) => logLines.push(msg)

      onProgress({ current: i, total: leads.length, status: `Checking: ${lead.name}`, found })

      const result = await enrichLead(page, gPage, lead, log, onCaptcha)
      enriched.push(result)

      for (const line of logLines) {
        onProgress({ current: i + 1, total: leads.length, status: line, found, log: line })
      }

      if (result.mcaData?.googleRevenue != null || result.mcaData?.mcaFound) {
        found++
        consecutiveErrors = 0
        let msg
        if (result.mcaData?.googleRevenue != null) {
          msg = `✓ ${lead.name} — Google: ${fmtCap(result.mcaData.googleRevenue)}`
        } else {
          const conf = result.mcaData.confidence ?? 100
          msg = `✓ ${lead.name} — MCA ${conf}% — ${fmtCap(result.mcaData.paidUpCapital)}`
        }
        onProgress({ current: i + 1, total: leads.length, status: msg, found, log: msg })
      } else if (result.mcaData?._navError) {
        // Only count navigation errors toward the circuit breaker, not legitimate "not found"
        consecutiveErrors++
        const msg = `— Nav error: ${lead.name}`
        onProgress({ current: i + 1, total: leads.length, status: msg, found, log: msg })
      } else {
        // Genuine "not found" — reset error count since Zauba Corp is responding normally
        consecutiveErrors = 0
        const msg = `— Not found: ${lead.name}`
        onProgress({ current: i + 1, total: leads.length, status: msg, found, log: msg })
      }

      if (page.isClosed()) continue  // loop will catch it at top

      // Between leads — go back to homepage so next goSearch finds the form immediately
      await safeGoto(page, 'https://www.zaubacorp.com', () => { })
      await safeWait(page, 1000 + Math.random() * 1000)
    }
  } catch (err) {
    // Catch any unexpected error — return whatever we've processed so far
    const remaining = leads.slice(enriched.length)
    enriched.push(...unenriched(remaining))
    emit(`⚠ Enrichment stopped: ${err.message.split('\n')[0]}`)
  } finally {
    try { await browser.close() } catch (_) { }
  }

  return enriched
}
