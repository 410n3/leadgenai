import { useState, useEffect } from 'react'

export default function SettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [apiSaved, setApiSaved] = useState(false)
  const [apiSaving, setApiSaving] = useState(false)
  const [apiError, setApiError] = useState('')



  const [useLocalMl, setUseLocalMl] = useState(false)
  const [localMlUrl, setLocalMlUrl] = useState('http://localhost:11434/v1')
  const [localMlModel, setLocalMlModel] = useState('qwen2.5:0.5b')
  const [mlSaved, setMlSaved] = useState(false)
  const [mlSaving, setMlSaving] = useState(false)
  const [mlStatus, setMlStatus] = useState(null) // { ok: bool, message: string }

  const [credStatus, setCredStatus] = useState(null) // null | 'ok' | 'error'
  const [credPath, setCredPath] = useState('')

  const [tier1, setTier1] = useState('50')
  const [tier2, setTier2] = useState('10')
  const [tierSaved, setTierSaved] = useState(false)
  const [tierSaving, setTierSaving] = useState(false)

  useEffect(() => {
    window.api.checkCredentials().then(info => {
      setCredStatus(info.credentialsExist ? 'ok' : 'missing')
      if (info.hasApiKey) setApiKey('••••••••••••••••••••••')
      if (typeof info.useLocalMl === 'boolean') setUseLocalMl(info.useLocalMl)
      if (info.localMlUrl) setLocalMlUrl(info.localMlUrl)
      if (info.localMlModel) setLocalMlModel(info.localMlModel)
    })
    window.api.getTierSettings().then(s => {
      setTier1(String(s.tier1Crores))
      setTier2(String(s.tier2Crores))
    }).catch(() => { })
  }, [])

  const handleSaveApiKey = async () => {
    const key = apiKey.trim()
    if (!key || key.startsWith('•')) return
    setApiSaving(true)
    setApiError('')
    try {
      await window.api.saveEnv({ anthropicKey: key }) // reuses same IPC, saves as NVIDIA_API_KEY
      setApiSaved(true)
      setTimeout(() => setApiSaved(false), 3000)
    } catch (e) {
      setApiError(e.message)
    } finally {
      setApiSaving(false)
    }
  }



  const handleSaveTiers = async () => {
    const t1 = parseFloat(tier1)
    const t2 = parseFloat(tier2)
    if (isNaN(t1) || isNaN(t2) || t1 <= t2 || t2 <= 0) return
    setTierSaving(true)
    try {
      await window.api.saveTierSettings({ tier1Crores: t1, tier2Crores: t2 })
      setTierSaved(true)
      setTimeout(() => setTierSaved(false), 3000)
    } catch (_) { }
    setTierSaving(false)
  }

  const handleSaveLocalMl = async () => {
    setMlSaving(true)
    try {
      await window.api.saveEnv({
        USE_LOCAL_ML: useLocalMl ? 'true' : 'false',
        LOCAL_ML_URL: localMlUrl,
        LOCAL_ML_MODEL: localMlModel
      })
      setMlSaved(true)
      setTimeout(() => setMlSaved(false), 3000)
    } catch (_) { }
    setMlSaving(false)
  }

  const handleCheckLocalMl = async () => {
    setMlStatus({ ok: false, message: 'Checking...' })
    try {
      const res = await window.api.checkLocalMl({ url: localMlUrl })
      if (res.ok) {
        setMlStatus({ ok: true, message: 'Server is running' })
      } else {
        setMlStatus({ ok: false, message: res.error || 'Server unreachable' })
      }
    } catch (e) {
      setMlStatus({ ok: false, message: e.message })
    }
  }

  const handleSelectCreds = async () => {
    const result = await window.api.selectCredentialsFile()
    if (result.success) {
      setCredStatus('ok')
      setCredPath(result.path)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-white font-semibold text-lg">Settings</h2>
          </div>
          <button
            className="text-slate-500 hover:text-white transition-colors p-1 rounded"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* NVIDIA API Key */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${apiKey.startsWith('•') ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <h3 className="font-semibold text-white">NVIDIA API Key</h3>
              <span className="text-xs text-slate-500 ml-auto">Nemotron NLP model</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                className="input-field flex-1"
                placeholder="nvapi-..."
                value={apiKey}
                onChange={e => {
                  setApiKey(e.target.value)
                  setApiSaved(false)
                }}
                onFocus={e => {
                  if (e.target.value.startsWith('•')) setApiKey('')
                }}
              />
              <button
                className="btn-primary shrink-0"
                onClick={handleSaveApiKey}
                disabled={apiSaving || !apiKey.trim() || apiKey.startsWith('•')}
              >
                {apiSaving ? 'Saving...' : apiSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            {apiError && <p className="text-red-400 text-xs mt-1.5">{apiError}</p>}
            <p className="text-slate-500 text-xs mt-1.5">
              Get key at{' '}
              <button
                className="text-blue-400 hover:underline"
                onClick={() => window.api.openExternal('https://build.nvidia.com/')}
              >
                build.nvidia.com
              </button>
            </p>
          </div>

          <div className="border-t border-slate-700 my-4" />

          {/* Local ML Settings */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${useLocalMl ? 'bg-green-400' : 'bg-slate-500'}`} />
              <h3 className="font-semibold text-white">Local ML Server</h3>
              <span className="text-xs text-slate-500 ml-auto">Ollama / LM Studio (Offline)</span>
            </div>

            <div className="flex items-center justify-between mb-4 bg-slate-800 p-3 rounded-lg border border-slate-700/50">
              <div className="text-sm font-medium text-slate-300">Enable Local ML Override</div>
              <button
                className={`w-11 h-6 rounded-full transition-colors relative ${useLocalMl ? 'bg-blue-500' : 'bg-slate-700'}`}
                onClick={() => { setUseLocalMl(!useLocalMl); setMlSaved(false) }}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${useLocalMl ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {useLocalMl && (
              <div className="space-y-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">OpenAI Compatible URL</label>
                  <input
                    type="text"
                    className="input-field w-full text-sm font-mono"
                    placeholder="http://localhost:11434/v1"
                    value={localMlUrl}
                    onChange={e => { setLocalMlUrl(e.target.value); setMlSaved(false) }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Model Name</label>
                  <input
                    type="text"
                    className="input-field w-full text-sm font-mono"
                    placeholder="qwen2.5:0.5b"
                    value={localMlModel}
                    onChange={e => { setLocalMlModel(e.target.value); setMlSaved(false) }}
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    className="btn-ghost text-xs flex-1"
                    onClick={handleCheckLocalMl}
                  >
                    Check Connection
                  </button>
                  <button
                    className="btn-primary text-xs flex-1"
                    onClick={handleSaveLocalMl}
                    disabled={mlSaving}
                  >
                    {mlSaving ? 'Saving...' : mlSaved ? '✓ Saved' : 'Save Config'}
                  </button>
                </div>
                {mlStatus && (
                  <p className={`text-xs mt-1 text-center font-medium ${mlStatus.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {mlStatus.ok ? `✓ ${mlStatus.message}` : `⚠ ${mlStatus.message}`}
                  </p>
                )}
              </div>
            )}
            <p className="text-slate-500 text-xs">
              Run local models (e.g. Ollama `qwen2.5:0.5b`) on &lt;1GB RAM instead of using NVIDIA.
            </p>
          </div>

          <div className="border-t border-slate-700 my-4" />



          {/* Tier Capital Thresholds */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <h3 className="font-semibold text-white">Tier Capital Thresholds</h3>
              <span className="text-xs text-slate-500 ml-auto">Paid-up capital (₹ Crores)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tier 1 minimum (₹ Cr)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field w-full"
                  placeholder="50"
                  value={tier1}
                  onChange={e => { setTier1(e.target.value); setTierSaved(false) }}
                />
                <p className="text-xs text-slate-600 mt-0.5">≥ this amount → Tier 1 (Gold)</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tier 2 minimum (₹ Cr)</label>
                <input
                  type="number"
                  min="1"
                  className="input-field w-full"
                  placeholder="10"
                  value={tier2}
                  onChange={e => { setTier2(e.target.value); setTierSaved(false) }}
                />
                <p className="text-xs text-slate-600 mt-0.5">≥ this amount → Tier 2 (Blue)</p>
              </div>
            </div>
            <button
              className="btn-primary w-full"
              onClick={handleSaveTiers}
              disabled={tierSaving}
            >
              {tierSaving ? 'Saving...' : tierSaved ? '✓ Saved' : 'Save Tier Thresholds'}
            </button>
            <p className="text-slate-500 text-xs mt-1.5">
              Applied to MCA paid-up capital. Defaults: ₹50 Cr (T1) and ₹10 Cr (T2).
            </p>
          </div>

          <div className="border-t border-slate-700" />

          {/* Google Credentials */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${credStatus === 'ok' ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <h3 className="font-semibold text-white">Google Service Account</h3>
              <span className="text-xs text-slate-500 ml-auto">Google Sheets access</span>
            </div>

            {credStatus === 'ok' && !credPath && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 text-sm text-green-300 mb-3">
                ✓ credentials.json is loaded
              </div>
            )}
            {credPath && (
              <div className="bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 text-xs text-green-300 mb-3 font-mono break-all">
                ✓ Saved to: {credPath}
              </div>
            )}

            <button className="btn-secondary w-full" onClick={handleSelectCreds}>
              {credStatus === 'ok' ? 'Replace credentials.json' : 'Select credentials.json'}
            </button>

            <div className="mt-3 bg-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-300">How to update credentials:</p>
              <p>1. Go to Google Cloud Console → your project</p>
              <p>2. IAM &amp; Admin → Service Accounts → your account → Keys</p>
              <p>3. Add Key → Create new key → JSON → download</p>
              <p>4. Click "Replace credentials.json" above and select the new file</p>
              <p>5. Re-share your spreadsheet with the new service account email if it changed</p>
              <button
                className="text-blue-400 hover:underline mt-1 block"
                onClick={() => window.api.openExternal('https://console.cloud.google.com/iam-admin/serviceaccounts')}
              >
                Open Google Cloud Console →
              </button>
            </div>
          </div>

          <div className="border-t border-slate-700" />

          {/* Spreadsheet link */}
          <div>
            <h3 className="font-semibold text-white mb-2">Google Spreadsheet</h3>
            <button
              className="text-blue-400 hover:underline text-sm"
              onClick={() => window.api.openExternal('https://docs.google.com/spreadsheets/d/1mNixw9OXD5rsnKEc3v7FrL_T7D2L0-Gk_D_IdVN7Llw/edit')}
            >
              Open your leads spreadsheet →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
