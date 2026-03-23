import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  checkCredentials: () => ipcRenderer.invoke('check-credentials'),
  saveUserInfo: (data) => ipcRenderer.invoke('save-user-info', data),
  processNlp: (params) => ipcRenderer.invoke('process-nlp', params),
  startScraping: (data) => ipcRenderer.invoke('start-scraping', data),
  saveLeads: (data) => ipcRenderer.invoke('save-leads', data),
  exportCsv: (data) => ipcRenderer.invoke('export-csv', data),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSheetUrl: () => ipcRenderer.invoke('get-sheet-url'),
  saveEnv: (data) => ipcRenderer.invoke('save-env', data),
  selectCredentialsFile: () => ipcRenderer.invoke('select-credentials-file'),
  runGoogleContacts: (data) => ipcRenderer.invoke('run-google-contacts', data),
  checkLocalMl: (data) => ipcRenderer.invoke('check-local-ml', data),

  onScrapingProgress: (callback) => {
    ipcRenderer.on('scraping-progress', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('scraping-progress')
  },
  onScrapingCaptcha: (cb) => {
    ipcRenderer.on('scraping-captcha', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('scraping-captcha')
  },

  getTierSettings: () => ipcRenderer.invoke('get-tier-settings'),
  saveTierSettings: (data) => ipcRenderer.invoke('save-tier-settings', data),

  enrichLeads: (data) => ipcRenderer.invoke('enrich-leads', data),
  onEnrichProgress: (cb) => {
    ipcRenderer.on('enrich-progress', (_, p) => cb(p))
    return () => ipcRenderer.removeAllListeners('enrich-progress')
  },
  onEnrichCaptcha: (cb) => {
    ipcRenderer.on('enrich-captcha', (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('enrich-captcha')
  },
  onContactProgress: (cb) => {
    ipcRenderer.on('contact-progress', (_, p) => cb(p))
    return () => ipcRenderer.removeAllListeners('contact-progress')
  },
  runLinkedInPerCompany: (data) => ipcRenderer.invoke('run-linkedin-per-company', data)
})
