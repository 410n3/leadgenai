import { useState } from 'react'

export default function Step1UserInfo({ formData, update, onNext }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isValid = formData.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)

  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)
    setError('')
    try {
      const res = await window.api.saveUserInfo({ name: formData.name.trim(), email: formData.email.trim() })
      update({ sessionId: res.sessionId })
      onNext()
    } catch (e) {
      setError('Failed to save to Google Sheets: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-600/20 rounded-xl mb-4 border border-violet-500/20">
          <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Welcome to Pippur</h1>
        <p className="text-slate-400 mt-1">Let's start with your details</p>
      </div>

      <div className="step-card space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name</label>
          <input
            className="input-field"
            placeholder="e.g. Maneesh Radhakrishnan"
            value={formData.name}
            onChange={e => update({ name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit()}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Email</label>
          <input
            className="input-field"
            type="email"
            placeholder="you@company.com"
            value={formData.email}
            onChange={e => update({ email: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && isValid && handleSubmit()}
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg px-4 py-2.5 text-sm">
            {error}
          </div>
        )}

        <button
          className="btn-primary w-full"
          disabled={!isValid || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
