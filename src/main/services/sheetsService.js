import { google } from 'googleapis'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'

const SPREADSHEET_ID = '1mNixw9OXD5rsnKEc3v7FrL_T7D2L0-Gk_D_IdVN7Llw'
const USERS_SHEET = 'Users'
const LEADS_SHEET = 'Leads'

function getCredentialsPath() {
  const paths = [
    join(app.getPath('userData'), 'credentials.json'),
    join(process.resourcesPath || '', 'credentials', 'credentials.json'),
    join(__dirname, '..', '..', '..', 'credentials', 'credentials.json')
  ]
  for (const p of paths) {
    if (existsSync(p)) return p
  }
  return null
}

function getAuthClient() {
  const credPath = getCredentialsPath()
  if (!credPath) {
    throw new Error(
      'credentials.json not found. Please place your Google Service Account credentials at:\n' +
      join(app.getPath('userData'), 'credentials.json')
    )
  }
  const creds = JSON.parse(readFileSync(credPath, 'utf8'))
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
}

async function ensureSheetExists(sheets, sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existing = spreadsheet.data.sheets.find(s => s.properties.title === sheetName)
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
    })
  }
}

export async function saveUserInfo({ name, email }) {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets, USERS_SHEET)

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${USERS_SHEET}!A1:D1`
  })
  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A1:D1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Name', 'Email', 'Timestamp', 'Session ID']] }
    })
  }

  const sessionId = Date.now().toString()
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${USERS_SHEET}!A:D`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[name, email, new Date().toISOString(), sessionId]] }
  })
  return sessionId
}

export async function saveLeads(leads, sessionId) {
  const auth = getAuthClient()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureSheetExists(sheets, LEADS_SHEET)

  // Always write/overwrite header row so new columns are always present
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LEADS_SHEET}!A1:Q1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        'Session ID', 'Company Name', 'Category', 'Address', 'Phone', 'Website',
        'Rating', 'Reviews', 'Tier', 'Tier Basis', 'CIN', 'Paid-up Capital (₹)', 'MCA Status',
        'Search Query', 'Scraped At', 'Decision Makers', 'LinkedIn URLs'
      ]]
    }
  })

  const rows = leads.map(lead => {
    const hasMca = lead.mcaData?.mcaFound
    const tierBasis = hasMca ? 'MCA Paid-up Capital' : 'Google Maps Reviews'
    return [
      sessionId,
      lead.name || '',
      lead.category || '',
      lead.fullAddress || lead.address || '',
      lead.phone || '',
      lead.website || '',
      lead.rating || '',
      lead.reviewCount || '',
      lead.tier || '',
      tierBasis,
      lead.mcaData?.cinNumber || '',
      lead.mcaData?.paidUpCapital != null ? lead.mcaData.paidUpCapital : '',
      hasMca ? (lead.mcaData?.status || 'Active') : '',
      lead.searchQuery || '',
      new Date().toISOString(),
      lead.googleContacts ? lead.googleContacts.map(c => c.name).filter(Boolean).join(', ') : '',
      lead.googleContacts ? lead.googleContacts.map(c => c.linkedinUrl).filter(Boolean).join(', ') : ''
    ]
  })

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LEADS_SHEET}!A:Q`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows }
  })
}

export function getSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
}

export function credentialsExist() {
  return !!getCredentialsPath()
}
