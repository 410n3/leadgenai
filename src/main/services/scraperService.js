import { chromium } from 'playwright'
import { solve } from 'recaptcha-solver'
import { injectPippurOverlay } from './browserOverlay.js'

const SCROLL_PAUSE = 1500
const MAX_SCROLL_ATTEMPTS = 15
const PLACE_PAGE_WAIT = 2000

function isGoogleCaptcha(page) {
  const url = page.url()
  return url.includes('/sorry/') || url.includes('google.com/sorry')
}

async function isGoogleError(page) {
  try {
    const visible = await page.locator('text="Something went wrong"').first().isVisible({ timeout: 1000 })
    return visible
  } catch (_) {
    return false
  }
}

async function setPippurStatus(page, text) {
  try {
    await page.evaluate(t => { if (window.__pippurSetStatus) window.__pippurSetStatus(t) }, text)
  } catch (_) {}
}

async function createBrowserSession() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 }
  })

  // Stealth: Advanced Fingerprinting Bypass
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel(R) Iris(R) Xe Graphics';
      return getParameter.apply(this, arguments);
    };
  });

  await injectPippurOverlay(context)


  const page = await context.newPage()
  return { browser, page }
}

async function waitAndRestartBrowser(browser, onProgress) {
  try { await browser.close() } catch (_) {}

  onProgress({
    status: '⚠ Google error detected — restarting browser in 60s...',
    recovering: true,
    recoverySecs: 60
  })

  for (let s = 59; s >= 0; s--) {
    await new Promise(r => setTimeout(r, 1000))
    onProgress({ status: `⏳ Restarting in ${s}s — Google flagged the request`, recovering: true, recoverySecs: s })
  }

  const session = await createBrowserSession()
  onProgress({ status: '✓ Browser restarted — resuming...', recovering: false, recoverySecs: 0 })
  return session
}

// Manual-only CAPTCHA wait — do not try auto-click (checkbox auto-click is unreliable)
async function waitForGoogleCaptcha(page, onCaptcha, onProgress) {
  onProgress({ status: '🔒 CAPTCHA detected — please click the checkbox in the browser window' })
  onCaptcha(true)
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000)
    if (!isGoogleCaptcha(page)) {
      onCaptcha(false)
      onProgress({ status: '✓ CAPTCHA solved — resuming...' })
      return true
    }
  }
  onCaptcha(false)
  return false
}

// Extract real URL from Google's redirect wrapper (/url?q=https://actual-site.com)
function extractRealUrl(href) {
  if (!href) return ''
  try {
    const url = new URL(href)
    if (url.hostname === 'www.google.com' && url.pathname === '/url') {
      return url.searchParams.get('q') || href
    }
  } catch (_) {}
  return href
}

export async function scrapeQuery(query, onProgress = () => {}, onCaptcha = () => {}) {
  let { browser, page } = await createBrowserSession()

  try {
    // ── Phase 1: Navigate ────────────────────────────────────────────────────
    onProgress({ status: '🌐 Step 1: Opening Google Maps...', found: 0, phase: 'navigating' })
    await setPippurStatus(page, 'Step 1: Opening Google Maps...')

    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

    // Check for Google CAPTCHA / "unusual traffic" page
    if (isGoogleCaptcha(page)) {
      onProgress({ status: '🔒 CAPTCHA detected — trying auto-solve...', phase: 'captcha' })
      await setPippurStatus(page, '🔒 Solving CAPTCHA...')
      const solved = await waitForGoogleCaptcha(page, onCaptcha, onProgress)
      if (!solved) {
        onProgress({ status: '✗ CAPTCHA timeout — skipping query', phase: 'error' })
        return []
      }
      onProgress({ status: '✓ CAPTCHA solved — resuming...', phase: 'navigating' })
    }

    // Check for "Something went wrong" on initial load
    if (await isGoogleError(page)) {
      const session = await waitAndRestartBrowser(browser, onProgress)
      browser = session.browser
      page = session.page
      await setPippurStatus(page, 'Step 1: Retrying Google Maps...')
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    // Handle consent dialog
    try {
      const consent = page.locator('button:has-text("Accept all"), form[action*="consent"] button').first()
      if (await consent.isVisible({ timeout: 3000 })) {
        await consent.click()
        await page.waitForTimeout(1000)
      }
    } catch (_) {}

    // ── Phase 2: Wait for feed ───────────────────────────────────────────────
    onProgress({ status: '⏳ Step 2: Waiting for results list...', found: 0, phase: 'loading' })
    await setPippurStatus(page, 'Step 2: Waiting for results list...')

    const hasFeed = await page.locator('[role="feed"]')
      .waitFor({ timeout: 15000 }).then(() => true).catch(() => false)

    if (!hasFeed) {
      const currentUrl = page.url()
      if (currentUrl.includes('/maps/place/')) {
        onProgress({ status: '📍 Step 2: Direct place page — extracting...', found: 1, phase: 'extracting' })
        await setPippurStatus(page, 'Step 2: Extracting place details...')
        await page.waitForTimeout(PLACE_PAGE_WAIT)

        const details = await page.evaluate(() => {
          const name = document.querySelector('h1')?.textContent?.trim() || ''
          const phone =
            document.querySelector('[data-item-id^="phone:tel:"] .Io6YTe')?.textContent?.trim() ||
            document.querySelector('[data-tooltip="Copy phone number"] .Io6YTe')?.textContent?.trim() || ''
          const websiteAnchor =
            document.querySelector('[data-item-id="authority"] a') ||
            document.querySelector('a[data-value="Website"]') ||
            document.querySelector('[aria-label="Open website"] a')
          const rawWebsite = websiteAnchor?.getAttribute('href') || ''
          const fullAddress =
            document.querySelector('[data-item-id="address"] .Io6YTe')?.textContent?.trim() ||
            document.querySelector('[data-tooltip="Copy address"] .Io6YTe')?.textContent?.trim() || ''
          const category =
            document.querySelector('button.DkEaL')?.textContent?.trim() ||
            document.querySelector('[jsaction*="category"]')?.textContent?.trim() || ''
          const rating = document.querySelector('.MW4etd')?.textContent?.trim() || ''
          let reviewCount = 0
          const reviewSelectors = [
            '[data-review-count]',
            'button[aria-label*="reviews"] span',
            'span[aria-label*="reviews"]',
            '.F7nice span[aria-label]'
          ]
          for (const sel of reviewSelectors) {
            const el = document.querySelector(sel)
            if (el) {
              const raw = el.getAttribute('aria-label') || el.textContent || ''
              const match = raw.replace(/,/g, '').match(/(\d+)/)
              if (match) { reviewCount = parseInt(match[1], 10); break }
            }
          }
          if (!reviewCount) {
            const ratingBtn = document.querySelector('button[data-value="Reviews"], [aria-label*="review"]')
            if (ratingBtn) {
              const match = (ratingBtn.getAttribute('aria-label') || '').replace(/,/g, '').match(/(\d+)/)
              if (match) reviewCount = parseInt(match[1], 10)
            }
          }
          return { name, phone, rawWebsite, fullAddress, category, rating, reviewCount }
        })

        if (details.name) {
          onProgress({ status: '✅ Done!', found: 1, total: 1, withinQueryPct: 1, phase: 'done' })
          return [{
            name: details.name,
            category: details.category,
            rating: details.rating,
            reviewCount: details.reviewCount || 0,
            address: details.fullAddress,
            fullAddress: details.fullAddress,
            phone: details.phone,
            website: extractRealUrl(details.rawWebsite),
            href: currentUrl
          }]
        }
      }

      onProgress({ status: 'No results found', found: 0, phase: 'done' })
      return []
    }

    // ── Phase 3: Scroll to load all listings ────────────────────────────────
    onProgress({ status: '📜 Step 3: Scrolling to load all businesses...', found: 0, phase: 'scrolling' })
    await setPippurStatus(page, 'Step 3: Scrolling to load all listings...')

    let prevCount = 0
    let noChangeCount = 0

    while (noChangeCount < 3 && noChangeCount < MAX_SCROLL_ATTEMPTS) {
      await page.evaluate(() => {
        const f = document.querySelector('[role="feed"]')
        if (f) f.scrollBy(0, 2000)
      })
      await page.waitForTimeout(SCROLL_PAUSE)

      const currentCount = await page.$$eval('[role="article"]', els => els.length).catch(() => 0)
      if (currentCount === prevCount) {
        noChangeCount++
      } else {
        noChangeCount = 0
        prevCount = currentCount
        onProgress({ status: `📋 Step 3: Found ${currentCount} businesses, scrolling more...`, found: currentCount, phase: 'scrolling' })
        await setPippurStatus(page, `Step 3: Scrolling... ${currentCount} businesses found`)
      }
    }

    // ── Phase 4: Collect basic info ──────────────────────────────────────────
    const basicResults = await page.evaluate(() => {
      const articles = document.querySelectorAll('[role="article"]')
      const seen = new Set()
      const results = []

      articles.forEach(article => {
        try {
          const link = article.querySelector('a[href*="/maps/place/"]')
          if (!link?.href) return

          const placeUrl = link.href.split('?')[0]
          if (seen.has(placeUrl)) return
          seen.add(placeUrl)

          const name = link.getAttribute('aria-label') ||
            article.querySelector('.qBF1Pd, .fontHeadlineSmall, h3')?.textContent?.trim() || ''
          if (!name) return

          const texts = Array.from(article.querySelectorAll('.W4Efsd span'))
            .map(s => s.textContent?.trim())
            .filter(t => t && t !== '·' && t !== '⋅' && t !== '·' && t.length > 1)

          const rating = article.querySelector('.MW4etd')?.textContent?.trim() || ''

          const reviewRaw = article.querySelector('.UY7F9')?.textContent ||
            article.querySelector('[aria-label*="reviews"]')?.getAttribute('aria-label') || ''
          const reviewMatch = reviewRaw.replace(/,/g, '').match(/(\d+)/)
          const reviewCount = reviewMatch ? parseInt(reviewMatch[1], 10) : 0

          results.push({
            name,
            href: link.href,
            category: texts[0] || '',
            address: texts[1] || '',
            rating,
            reviewCount
          })
        } catch (_) {}
      })
      return results
    })

    onProgress({
      status: `🔍 Step 4: Visiting ${basicResults.length} business pages for details...`,
      found: 0,
      total: basicResults.length,
      withinQueryPct: 0,
      phase: 'visiting'
    })
    await setPippurStatus(page, `Step 4: Visiting ${basicResults.length} business pages...`)

    // ── Phase 5: Navigate to each place URL ──────────────────────────────────
    const detailedResults = []

    for (let i = 0; i < basicResults.length; i++) {
      const biz = basicResults[i]
      const withinQueryPct = i / basicResults.length

      onProgress({
        status: `📍 Step 4: Visiting ${i + 1}/${basicResults.length} — ${biz.name}`,
        found: detailedResults.length,
        total: basicResults.length,
        withinQueryPct,
        phase: 'visiting'
      })
      await setPippurStatus(page, `[${i + 1}/${basicResults.length}] ${biz.name}`)

      try {
        await page.goto(biz.href, { waitUntil: 'domcontentloaded', timeout: 20000 })

        // Handle "Something went wrong" on a business page
        if (await isGoogleError(page)) {
          const session = await waitAndRestartBrowser(browser, onProgress)
          browser = session.browser
          page = session.page
          await setPippurStatus(page, `Retrying: ${biz.name}`)
          await page.goto(biz.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        }

        if (isGoogleCaptcha(page)) {
          onProgress({ status: '🔒 CAPTCHA — trying auto-solve...', phase: 'captcha' })
          await setPippurStatus(page, '🔒 Solving CAPTCHA...')
          const solved = await waitForGoogleCaptcha(page, onCaptcha, onProgress)
          if (!solved) break
          onProgress({ status: '✓ CAPTCHA solved — resuming...', phase: 'visiting' })
          await page.goto(biz.href, { waitUntil: 'domcontentloaded', timeout: 20000 })
        }

        await setPippurStatus(page, `Extracting: ${biz.name}`)
        await page.waitForTimeout(PLACE_PAGE_WAIT)

        const details = await page.evaluate(() => {
          const phone =
            document.querySelector('[data-item-id^="phone:tel:"] .Io6YTe')?.textContent?.trim() ||
            document.querySelector('[data-tooltip="Copy phone number"] .Io6YTe')?.textContent?.trim() ||
            ''

          const websiteAnchor =
            document.querySelector('[data-item-id="authority"] a') ||
            document.querySelector('a[data-value="Website"]') ||
            document.querySelector('[aria-label="Open website"] a')
          const rawWebsite = websiteAnchor?.getAttribute('href') || ''

          const fullAddress =
            document.querySelector('[data-item-id="address"] .Io6YTe')?.textContent?.trim() ||
            document.querySelector('[data-tooltip="Copy address"] .Io6YTe')?.textContent?.trim() ||
            ''

          const category =
            document.querySelector('button.DkEaL')?.textContent?.trim() ||
            document.querySelector('[jsaction*="category"]')?.textContent?.trim() ||
            ''

          let reviewCount = 0
          const reviewSelectors = [
            '[data-review-count]',
            'button[aria-label*="reviews"] span',
            'span[aria-label*="reviews"]',
            '.F7nice span[aria-label]'
          ]
          for (const sel of reviewSelectors) {
            const el = document.querySelector(sel)
            if (el) {
              const raw = el.getAttribute('aria-label') || el.textContent || ''
              const match = raw.replace(/,/g, '').match(/(\d+)/)
              if (match) { reviewCount = parseInt(match[1], 10); break }
            }
          }
          if (!reviewCount) {
            const ratingBtn = document.querySelector('button[data-value="Reviews"], [aria-label*="review"]')
            if (ratingBtn) {
              const match = (ratingBtn.getAttribute('aria-label') || '').replace(/,/g, '').match(/(\d+)/)
              if (match) reviewCount = parseInt(match[1], 10)
            }
          }

          return { phone, rawWebsite, fullAddress, category, reviewCount }
        })

        detailedResults.push({
          name: biz.name,
          category: details.category || biz.category,
          rating: biz.rating,
          reviewCount: details.reviewCount || 0,
          address: biz.address,
          fullAddress: details.fullAddress || biz.address,
          phone: details.phone,
          website: extractRealUrl(details.rawWebsite),
          href: biz.href
        })
      } catch (_) {
        detailedResults.push({ ...biz, phone: '', website: '', fullAddress: biz.address, reviewCount: biz.reviewCount || 0 })
      }
    }

    onProgress({ status: '✅ Done!', found: detailedResults.length, total: detailedResults.length, withinQueryPct: 1, phase: 'done' })
    return detailedResults
  } finally {
    await browser.close()
  }
}

export async function scrapeAllQueries(queries, onProgress = () => {}, onCaptcha = () => {}) {
  const allLeads = []

  for (let qi = 0; qi < queries.length; qi++) {
    const { query } = queries[qi]

    onProgress({
      queryIndex: qi,
      totalQueries: queries.length,
      currentQuery: query,
      status: `🔎 Query ${qi + 1}/${queries.length}: ${query}`,
      found: 0,
      total: 0,
      withinQueryPct: 0,
      totalFound: allLeads.length,
      phase: 'navigating'
    })

    try {
      const results = await scrapeQuery(query, ({ status, found, total, withinQueryPct, phase, recovering, recoverySecs }) => {
        onProgress({
          queryIndex: qi,
          totalQueries: queries.length,
          currentQuery: query,
          status,
          found,
          total,
          withinQueryPct: withinQueryPct ?? 0,
          totalFound: allLeads.length,
          phase: phase || 'working',
          recovering: recovering || false,
          recoverySecs: recoverySecs || 0
        })
      }, onCaptcha)

      allLeads.push(...results.map(r => ({ ...r, searchQuery: query })))

      // Mark this query as fully complete
      onProgress({
        queryIndex: qi + 1,
        totalQueries: queries.length,
        currentQuery: query,
        status: `✓ Query ${qi + 1}/${queries.length} complete — ${results.length} leads found`,
        found: results.length,
        total: results.length,
        withinQueryPct: 0,
        totalFound: allLeads.length,
        phase: 'done'
      })
    } catch (err) {
      onProgress({
        queryIndex: qi + 1,
        totalQueries: queries.length,
        currentQuery: query,
        status: `✗ Error on query ${qi + 1}: ${err.message}`,
        found: 0,
        total: 0,
        withinQueryPct: 0,
        totalFound: allLeads.length,
        phase: 'error'
      })
    }

    if (qi < queries.length - 1) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  return allLeads
}
