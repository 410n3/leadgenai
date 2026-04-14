import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Point Playwright to bundled Chromium in packaged app
if (!is.dev) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = join(process.resourcesPath, 'playwright-browsers')
}
import { saveUserInfo, saveLeads, getSheetUrl, credentialsExist } from './services/sheetsService'
import { generateSearchQueries } from './services/nlpService'
import { scrapeAllQueries } from './services/scraperService'
import { enrichLeads } from './services/enrichService.js'
import { runLinkedInContactScraper, runLinkedInProfileSearchPerCompany } from './services/contactScraperService.js'

// Load .env from app userData
function loadEnv() {
  try {
    const envPath = join(app.getPath('userData'), '.env')
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach(line => {
        const eqIdx = line.indexOf('=')
        if (eqIdx > 0) {
          const key = line.slice(0, eqIdx).trim()
          const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
          if (key) process.env[key] = val
        }
      })
    }
  } catch (_) { }
}

function readEnvMap() {
  const envPath = join(app.getPath('userData'), '.env')
  const map = {}
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const idx = line.indexOf('=')
      if (idx > 0) {
        const k = line.slice(0, idx).trim()
        const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        if (k) map[k] = v
      }
    })
  }
  return map
}

function writeEnvMap(map) {
  const envPath = join(app.getPath('userData'), '.env')
  const content = Object.entries(map).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  writeFileSync(envPath, content, 'utf8')
}

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  loadEnv()
  electronApp.setAppUserModelId('com.pippur.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.handle('check-credentials', async () => {
  const hasCredentials = credentialsExist()
  const hasApiKey = !!process.env.NVIDIA_API_KEY
  const hasApifyKey = !!process.env.APIFY_API_KEY
  const userDataPath = app.getPath('userData')
  const useLocalMl = process.env.USE_LOCAL_ML === 'true'
  const localMlUrl = process.env.LOCAL_ML_URL || 'http://localhost:11434/v1'
  const localMlModel = process.env.LOCAL_ML_MODEL || 'qwen2.5:0.5b'

  return {
    credentialsExist: hasCredentials,
    hasApiKey,
    hasApifyKey,
    userDataPath,
    useLocalMl,
    localMlUrl,
    localMlModel
  }
})

ipcMain.handle('save-user-info', async (_event, { name, email }) => {
  const sessionId = await saveUserInfo({ name, email })
  return { success: true, sessionId, sheetUrl: getSheetUrl() }
})

ipcMain.handle('process-nlp', (_event, params) => {
  return generateSearchQueries(params)
})

ipcMain.handle('start-scraping', async (event, { queries, sessionId }) => {
  const allLeads = await scrapeAllQueries(
    queries,
    (progress) => event.sender.send('scraping-progress', progress),
    (active) => event.sender.send('scraping-captcha', { active })
  )
  return { leads: allLeads, count: allLeads.length }
})

ipcMain.handle('enrich-leads', async (event, { leads }) => {
  const results = await enrichLeads(
    leads,
    (progress) => event.sender.send('enrich-progress', progress),
    (active) => event.sender.send('enrich-captcha', { active })
  )
  return { leads: results }
})

ipcMain.handle('save-leads', async (_event, { leads, sessionId }) => {
  await saveLeads(leads, sessionId)
  return { success: true, sheetUrl: getSheetUrl() }
})

ipcMain.handle('export-csv', async (_event, { leads }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Leads as CSV',
    defaultPath: `leads-${Date.now()}.csv`,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (canceled || !filePath) return { success: false }

  // Build CSV manually (simple)
  const headers = ['Name', 'Category', 'Address', 'Phone', 'Website', 'Rating', 'Reviews', 'Tier', 'CIN', 'Paid-up Capital', 'MCA Status', 'Search Query', 'Decision Maker Name', 'Contact Email', 'Contact LinkedIn', 'Contact Verified']
  const rows = leads.map(l => [
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.fullAddress || l.address || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.website || '').replace(/"/g, '""')}"`,
    `"${(l.rating || '').replace(/"/g, '""')}"`,
    `"${(l.reviewCount || '').toString()}"`,
    `"${(l.tier || '').toString()}"`,
    `"${(l.mcaData?.cinNumber || '').replace(/"/g, '""')}"`,
    `"${l.mcaData?.paidUpCapital != null ? l.mcaData.paidUpCapital : ''}"`,
    `"${(l.mcaData?.mcaFound ? (l.mcaData.status || 'Active') : '').replace(/"/g, '""')}"`,
    `"${(l.searchQuery || '').replace(/"/g, '""')}"`,
    `"${(l.googleContacts ? l.googleContacts.map(c => c.name).filter(Boolean).join(', ') : '').replace(/"/g, '""')}"`,
    `"${(l.googleContacts ? l.googleContacts.map(c => c.email).filter(Boolean).join(', ') : '').replace(/"/g, '""')}"`,
    `"${(l.googleContacts ? l.googleContacts.map(c => c.linkedinUrl).filter(Boolean).join(', ') : '').replace(/"/g, '""')}"`,
    `"${l.googleContacts && l.googleContacts.length > 0 ? (l.googleContacts.every(c => c.verified === true) ? 'Yes' : l.googleContacts.some(c => c.verified === true) ? 'Partial' : 'No') : ''}"`
  ])
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  writeFileSync(filePath, csv, 'utf8')
  return { success: true, filePath }
})

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url)
})

ipcMain.handle('get-sheet-url', async () => {
  return getSheetUrl()
})

ipcMain.handle('save-env', async (_event, params) => {
  const { anthropicKey, apifyKey, USE_LOCAL_ML, LOCAL_ML_URL, LOCAL_ML_MODEL } = params
  const map = readEnvMap()
  if (anthropicKey !== undefined) {
    map.NVIDIA_API_KEY = anthropicKey
    process.env.NVIDIA_API_KEY = anthropicKey
  }
  if (apifyKey !== undefined) {
    map.APIFY_API_KEY = apifyKey
    process.env.APIFY_API_KEY = apifyKey
  }

  if (USE_LOCAL_ML !== undefined) {
    map.USE_LOCAL_ML = USE_LOCAL_ML
    process.env.USE_LOCAL_ML = USE_LOCAL_ML
  }
  if (LOCAL_ML_URL !== undefined) {
    map.LOCAL_ML_URL = LOCAL_ML_URL
    process.env.LOCAL_ML_URL = LOCAL_ML_URL
  }
  if (LOCAL_ML_MODEL !== undefined) {
    map.LOCAL_ML_MODEL = LOCAL_ML_MODEL
    process.env.LOCAL_ML_MODEL = LOCAL_ML_MODEL
  }
  writeEnvMap(map)
  return { success: true }
})

ipcMain.handle('check-local-ml', async (_event, { url }) => {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/models`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('run-google-contacts', async (event, inputs) => {
  const items = await runLinkedInContactScraper(
    inputs,
    (progress) => event.sender.send('contact-progress', progress)
  )
  return { items }
})

ipcMain.handle('run-linkedin-per-company', async (event, inputs) => {
  const items = await runLinkedInProfileSearchPerCompany(
    inputs,
    (progress) => event.sender.send('contact-progress', progress)
  )
  return { items }
})


ipcMain.handle('get-tier-settings', async () => {
  return {
    tier1Crores: parseFloat(process.env.TIER1_CRORES) || 50,
    tier2Crores: parseFloat(process.env.TIER2_CRORES) || 10
  }
})

ipcMain.handle('save-tier-settings', async (_event, { tier1Crores, tier2Crores }) => {
  const map = readEnvMap()
  map.TIER1_CRORES = String(tier1Crores)
  map.TIER2_CRORES = String(tier2Crores)
  writeEnvMap(map)
  process.env.TIER1_CRORES = String(tier1Crores)
  process.env.TIER2_CRORES = String(tier2Crores)
  return { success: true }
})

ipcMain.handle('select-credentials-file', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Google Service Account credentials.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || !filePaths.length) return { success: false }

  const destPath = join(app.getPath('userData'), 'credentials.json')
  copyFileSync(filePaths[0], destPath)
  return { success: true, path: destPath }
})
