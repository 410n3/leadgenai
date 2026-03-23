import { useState, useEffect, useRef } from 'react'

const PHASE_STEPS = [
  { key: 'navigating', icon: '🌐', label: 'Opening Google Maps' },
  { key: 'loading', icon: '⏳', label: 'Loading results list' },
  { key: 'captcha', icon: '🔒', label: 'Solving CAPTCHA' },
  { key: 'scrolling', icon: '📜', label: 'Scrolling to load businesses' },
  { key: 'visiting', icon: '📍', label: 'Visiting each business page' },
  { key: 'extracting', icon: '🔍', label: 'Extracting details' },
  { key: 'done', icon: '✅', label: 'Query complete' },
]

const PHASE_ORDER = PHASE_STEPS.map(s => s.key)

export default function Step8Scraping({ formData, update, onNext, onBack }) {
  const [progress, setProgress] = useState({
    status: 'Initializing...',
    queryIndex: 0,
    totalQueries: formData.generatedQueries.length,
    currentQuery: '',
    found: 0,
    total: 0,
    withinQueryPct: 0,
    totalFound: 0,
    phase: 'navigating',
    recovering: false,
    recoverySecs: 0
  })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [logs, setLogs] = useState([])
  const [captchaActive, setCaptchaActive] = useState(false)
  const logsEndRef = useRef(null)
  const cleanupRef = useRef(null)
  const captchaCleanupRef = useRef(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true

    captchaCleanupRef.current = window.api.onScrapingCaptcha(({ active }) => {
      setCaptchaActive(active)
    })

    cleanupRef.current = window.api.onScrapingProgress((data) => {
      setProgress(data)
      setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${data.status}`])
    })

    window.api.startScraping({
      queries: formData.generatedQueries,
      sessionId: formData.sessionId
    }).then(async (result) => {
      update({ leads: result.leads })
      setProgress(p => ({ ...p, status: `Complete! Found ${result.count} leads.`, totalFound: result.count, phase: 'done' }))
      setDone(true)
    }).catch((e) => {
      setError(e.message)
    })

    return () => {
      if (cleanupRef.current) cleanupRef.current()
      if (captchaCleanupRef.current) captchaCleanupRef.current()
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Progress = (completedQueries + withinQueryFraction) / totalQueries
  const withinFrac = progress.withinQueryPct || 0
  const pct = progress.totalQueries > 0
    ? Math.min(100, Math.round(((progress.queryIndex + withinFrac) / progress.totalQueries) * 100))
    : 0

  // Determine which PHASE_STEPS are done / active / pending
  const currentPhaseIdx = PHASE_ORDER.indexOf(progress.phase)

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {done ? '✅ Scraping Complete!' : '🔍 Scraping Google Maps...'}
        </h1>
        <p className="text-slate-400 mt-1">
          {done
            ? `Found ${formData.leads.length} businesses`
            : "Chromium is running — please don't close the browser window"}
        </p>
      </div>

      {/* Overall progress */}
      <div className="step-card mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-300 text-sm font-medium">Overall Progress</span>
          <span className="text-blue-400 font-bold">{done ? 100 : pct}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Query {Math.min(progress.queryIndex + 1, progress.totalQueries)} of {progress.totalQueries}</span>
          <span className="text-green-400 font-medium">{progress.totalFound} leads found</span>
        </div>
      </div>

      {/* Recovery banner */}
      {progress.recovering && (
        <div className="mb-4 rounded-xl border border-orange-500/60 bg-orange-900/20 px-4 py-3 flex items-start gap-3">
          <span className="text-2xl shrink-0">⚠️</span>
          <div>
            <p className="text-orange-300 font-semibold text-sm">Google detected automated browsing</p>
            <p className="text-orange-400/80 text-xs mt-0.5">
              Restarting browser and pausing {progress.recoverySecs > 0 ? `— ${progress.recoverySecs}s remaining` : '— resuming now...'}
            </p>
          </div>
        </div>
      )}

      {/* CAPTCHA alert */}
      {captchaActive && !progress.recovering && (
        <div className="mb-4 rounded-xl border border-yellow-500/60 bg-yellow-900/30 px-4 py-3 flex items-start gap-3 animate-pulse">
          <span className="text-2xl shrink-0">🔒</span>
          <div>
            <p className="text-yellow-300 font-semibold text-sm">Google CAPTCHA detected</p>
            <p className="text-yellow-400/80 text-xs mt-0.5">
              Please solve the CAPTCHA in the Chromium window — scraping resumes automatically once solved.
            </p>
          </div>
        </div>
      )}

      {/* What Pippur is doing — step-by-step */}
      {!done && !error && (
        <div className="step-card mb-4">
          <p className="text-xs text-slate-500 mb-3 font-medium tracking-wide uppercase">What Pippur is doing</p>
          <div className="space-y-2">
            {PHASE_STEPS.map((step, idx) => {
              const isDone = idx < currentPhaseIdx
              const isActive = idx === currentPhaseIdx
              const isPending = idx > currentPhaseIdx
              return (
                <div key={step.key} className={`flex items-center gap-2.5 text-sm transition-all ${isActive ? 'text-blue-300'
                    : isDone ? 'text-green-400'
                      : 'text-slate-600'
                  }`}>
                  <span className={`text-base ${isActive ? 'animate-pulse' : ''}`}>
                    {isDone ? '✓' : step.icon}
                  </span>
                  <span className={isDone ? 'line-through opacity-60' : ''}>
                    {step.label}
                  </span>
                  {isActive && progress.found > 0 && progress.total > 0 && (
                    <span className="ml-auto text-xs text-blue-400/70 font-mono">
                      {progress.found}/{progress.total}
                    </span>
                  )}
                  {isActive && progress.phase === 'scrolling' && progress.found > 0 && (
                    <span className="ml-auto text-xs text-blue-400/70 font-mono">
                      {progress.found} found
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {progress.currentQuery && (
            <p className="text-slate-500 text-xs mt-3 pt-3 border-t border-slate-700/50 truncate">
              Query: {progress.currentQuery}
            </p>
          )}
        </div>
      )}

      {/* Current status pill */}
      {!done && !error && (
        <div className="step-card mb-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 animate-pulse shrink-0" />
            <p className="text-slate-300 text-sm font-medium">{progress.status}</p>
          </div>
        </div>
      )}

      {/* Query progress chips */}
      {formData.generatedQueries.length > 0 && (
        <div className="step-card mb-4">
          <p className="text-xs text-slate-500 mb-2">Queries</p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {formData.generatedQueries.map((q, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-all ${done || i < progress.queryIndex
                    ? 'border-green-600/50 bg-green-900/20 text-green-400'
                    : i === progress.queryIndex && !done
                      ? 'border-blue-500 bg-blue-900/30 text-blue-300 animate-pulse'
                      : 'border-slate-700 text-slate-600'
                  }`}
              >
                {i < progress.queryIndex || done ? '✓ ' : i === progress.queryIndex ? '⟳ ' : ''}
                {q.query.length > 30 ? q.query.slice(0, 30) + '...' : q.query}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="step-card mb-4">
        <p className="text-xs text-slate-500 mb-2">Activity Log</p>
        <div className="bg-slate-900/50 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-xs text-slate-400 space-y-0.5">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          {!logs.length && <div className="text-slate-600">Waiting for activity...</div>}
          <div ref={logsEndRef} />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4">
          <p className="text-red-300 font-medium">Error occurred</p>
          <p className="text-red-400 text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        {done && (
          <button className="btn-ghost" onClick={onBack}>← Back</button>
        )}
        {done && (
          <button className="btn-primary flex-1 py-3 text-base" onClick={onNext}>
            Continue ({formData.leads.length} leads) →
          </button>
        )}
      </div>
    </div>
  )
}
