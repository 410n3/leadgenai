import { useState } from 'react'

export default function SetupScreen({ setupInfo, onComplete }) {
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [credStatus, setCredStatus] = useState(setupInfo.credentialsExist ? 'ok' : 'missing')
  const [apiStatus, setApiStatus] = useState(setupInfo.hasApiKey ? 'ok' : 'missing')
  const [error, setError] = useState('')

  const handleSelectCreds = async () => {
    const result = await window.api.selectCredentialsFile()
    if (result.success) setCredStatus('ok')
  }

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await window.api.saveEnv({ anthropicKey: apiKey.trim() })
      setApiStatus('ok')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const canContinue = credStatus === 'ok' && apiStatus === 'ok'

  return (
    <div className="flex flex-col items-center justify-center h-screen px-8">
      <div className="drag-region absolute top-0 left-0 right-0 h-8" />

      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600/20 border border-violet-500/30 rounded-2xl mb-4 backdrop-blur-xl">
            <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Pippur Setup</h1>
          <p className="text-slate-400 mt-1">One-time setup — takes 2 minutes</p>
        </div>

        {/* Step 1: Anthropic API Key */}
        <div className={`card mb-4 ${apiStatus === 'ok' ? 'border-green-600/50' : ''}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-white">1. NVIDIA API Key</h2>
              <p className="text-slate-400 text-sm mt-0.5">Used for NLP query generation (Nemotron model)</p>
            </div>
            {apiStatus === 'ok' && (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Set
              </span>
            )}
          </div>
          {apiStatus !== 'ok' && (
            <div className="flex gap-2">
              <input
                type="password"
                className="input-field flex-1"
                placeholder="nvapi-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
              />
              <button className="btn-primary" onClick={handleSaveApiKey} disabled={saving || !apiKey.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
          <p className="text-slate-500 text-xs mt-2">
            Get your key at{' '}
            <button
              className="text-blue-400 hover:underline"
              onClick={() => window.api.openExternal('https://build.nvidia.com/')}
            >
              build.nvidia.com
            </button>
          </p>
        </div>

        {/* Step 2: Google Credentials */}
        <div className={`card mb-6 ${credStatus === 'ok' ? 'border-green-600/50' : ''}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-white">2. Google Sheets Credentials</h2>
              <p className="text-slate-400 text-sm mt-0.5">Service account JSON for Google Sheets API</p>
            </div>
            {credStatus === 'ok' && (
              <span className="text-green-400 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Loaded
              </span>
            )}
          </div>
          {credStatus !== 'ok' && (
            <button className="btn-secondary w-full" onClick={handleSelectCreds}>
              Select credentials.json
            </button>
          )}
          <div className="mt-3 bg-slate-900/50 rounded-lg p-3 text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">How to get credentials:</p>
            <p>1. Go to Google Cloud Console → create/select project</p>
            <p>2. Enable "Google Sheets API"</p>
            <p>3. Create a Service Account → download JSON key</p>
            <p>4. Share your Google Sheet with the service account email</p>
            <button
              className="text-blue-400 hover:underline mt-1"
              onClick={() => window.api.openExternal('https://console.cloud.google.com/')}
            >
              Open Google Cloud Console →
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Save path: <code className="text-slate-400">{setupInfo.userDataPath}/credentials.json</code>
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        <button
          className="btn-primary w-full py-3 text-base"
          disabled={!canContinue}
          onClick={onComplete}
        >
          {canContinue ? 'Continue to App →' : 'Complete setup above to continue'}
        </button>
      </div>
    </div>
  )
}
