import { useState, useEffect, useRef } from 'react'

// Color-codes the confidence % inside a log line
function LogLine({ line }) {
  if (line.startsWith('✓')) {
    // Split on "XX% match" to color it
    const parts = line.split(/(\d+% match)/)
    return (
      <div className="text-green-400">
        {parts.map((part, i) => {
          const m = part.match(/^(\d+)% match$/)
          if (!m) return <span key={i}>{part}</span>
          const pct = parseInt(m[1])
          const col = pct >= 70 ? '#4ade80' : pct >= 50 ? '#facc15' : '#fb923c'
          return <span key={i} style={{ color: col, fontWeight: 'bold' }}>{part}</span>
        })}
      </div>
    )
  }
  if (line.startsWith('  AI candidates')) return <div className="text-violet-400">{line}</div>
  if (line.startsWith('  →')) return <div className="text-blue-400">{line}</div>
  if (line.startsWith('—')) return <div className="text-slate-500">{line}</div>
  return <div className="text-slate-600">{line}</div>
}

export default function StepEnrich({ formData, update, onNext, onBack }) {
  const [progress, setProgress] = useState({ current: 0, total: 0, found: 0, status: 'Starting...' })
  const [logs, setLogs] = useState([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [captchaActive, setCaptchaActive] = useState(false)
  const logsEndRef = useRef(null)
  const cleanupRef = useRef(null)
  const captchaCleanupRef = useRef(null)
  const hasStarted = useRef(false)

  const leads = formData.uniqueLeads || []

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    cleanupRef.current = window.api.onEnrichProgress((data) => {
      setProgress(data)
      if (data.log) {
        setLogs(prev => [...prev.slice(-100), data.log])
      }
    })

    captchaCleanupRef.current = window.api.onEnrichCaptcha(({ active }) => {
      setCaptchaActive(active)
    })

    window.api.enrichLeads({ leads }).then((result) => {
      update({ enrichedLeads: result.leads })
      setDone(true)
    }).catch((e) => {
      setError(e.message || 'Enrichment failed')
      update({ enrichedLeads: leads.map(l => ({ ...l, mcaData: { mcaFound: false } })) })
      setDone(true)
    })

    return () => {
      if (cleanupRef.current) cleanupRef.current()
      if (captchaCleanupRef.current) captchaCleanupRef.current()
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleSkip = () => {
    update({ enrichedLeads: leads.map(l => ({ ...l, mcaData: { mcaFound: false } })) })
    onNext()
  }

  const pct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const total = progress.total || leads.length

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {done ? '✅ Google + MCA Lookup Complete!' : '🔍 Google + MCA Lookup...'}
        </h1>
        <p className="text-slate-400 mt-1">
          {done
            ? `Found ${progress.found} of ${total} companies in MCA database`
            : 'Looking up company registrations — please don\'t close the browser'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="step-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 text-sm font-medium">Progress</span>
          <span className="text-violet-400 font-bold">{done ? 100 : pct}%</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-700 to-violet-400 rounded-full transition-all duration-500"
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{progress.current} / {total} companies checked</span>
          <span className="text-green-400 font-medium">{progress.found} MCA matches</span>
        </div>
      </div>

      {/* Current status */}
      {!done && !error && (
        <div className="step-card mb-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full mt-2 animate-pulse shrink-0" />
            <p className="text-slate-300 text-sm font-medium">{progress.status}</p>
          </div>
        </div>
      )}

      {/* CAPTCHA alert */}
      {captchaActive && (
        <div className="mb-4 rounded-xl border border-yellow-500/60 bg-yellow-900/30 px-4 py-3 flex items-start gap-3 animate-pulse">
          <span className="text-2xl shrink-0">🔒</span>
          <div>
            <p className="text-yellow-300 font-semibold text-sm">CAPTCHA detected in the browser window</p>
            <p className="text-yellow-400/80 text-xs mt-0.5">
              Please solve the CAPTCHA manually in the Chromium window — enrichment will resume automatically once solved.
            </p>
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="step-card mb-4">
        <p className="text-xs text-slate-500 mb-2">Activity Log</p>
        <div className="bg-black/30 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
          {logs.map((line, i) => <LogLine key={i} line={line} />)}
          {!logs.length && <div className="text-slate-600">Waiting for results...</div>}
          <div ref={logsEndRef} />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
          <p className="text-red-300 font-medium">Error during enrichment</p>
          <p className="text-red-400 text-sm mt-1">{error}</p>
          <p className="text-slate-400 text-xs mt-2">Proceeding with review-count based tier classification.</p>
        </div>
      )}

      {done && (
        <div className="step-card mb-4 bg-indigo-900/20 border border-indigo-700/40">
          <p className="text-indigo-300 font-medium text-sm">Google + MCA Lookup Summary</p>
          <p className="text-slate-300 text-sm mt-1">
            <span className="font-bold text-white">{progress.found}</span> of{' '}
            <span className="font-bold text-white">{total}</span> companies found in MCA database
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Companies with MCA data will be classified by paid-up capital. Others use review count.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        {!done && (
          <button className="btn-ghost" onClick={handleSkip}>
            Skip Enrichment
          </button>
        )}
        {done && (
          <button className="btn-primary flex-1 py-3" onClick={onNext}>
            Continue to Tier Sort →
          </button>
        )}
      </div>
    </div>
  )
}
