import { useState, useEffect } from 'react'

export default function Step7Preview({ formData, update, onNext, onBack }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!formData.generatedQueries.length) {
      generateQueries()
    }
  }, [])

  const generateQueries = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.processNlp({
        companies: formData.companies,
        companyTypes: formData.companyTypes,
        hasCompanyList: formData.hasCompanyList,
        city: formData.city,
        district: formData.district,
        state: formData.state,
        country: formData.country,
        pincodes: formData.pincodes,
        searchScope: formData.searchScope
      })
      update({ generatedQueries: result.queries, querySummary: result.summary })
    } catch (e) {
      setError('NLP processing failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteQuery = (index) => {
    const updated = formData.generatedQueries.filter((_, i) => i !== index)
    update({ generatedQueries: updated })
  }

  const queries = formData.generatedQueries

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Search Plan Preview</h1>
        <p className="text-slate-400 mt-1">Review and edit the queries before scraping</p>
      </div>

      {loading && (
        <div className="step-card flex flex-col items-center py-12 gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-white font-medium">Generating search queries...</p>
            <p className="text-slate-400 text-sm mt-1">AI is processing your parameters</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-6 mb-4">
          <p className="text-red-300">{error}</p>
          <button className="btn-secondary mt-3" onClick={generateQueries}>Retry</button>
        </div>
      )}

      {!loading && !error && queries.length > 0 && (
        <>
          {formData.querySummary && (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 mb-4">
              <p className="text-blue-200 text-sm">{formData.querySummary}</p>
            </div>
          )}

          <div className="step-card mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-white">
                {queries.length} search {queries.length === 1 ? 'query' : 'queries'}
                {queries.length !== formData.generatedQueries.length && (
                  <span className="text-slate-500 font-normal text-sm ml-2">(edited)</span>
                )}
              </p>
              <button className="text-blue-400 text-sm hover:text-blue-300" onClick={generateQueries}>
                Regenerate
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {queries.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2.5 group"
                >
                  <span className="text-slate-600 text-xs font-mono w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{q.query}</p>
                    <div className="flex gap-3 mt-0.5">
                      {q.pincode && q.pincode !== 'all' && (
                        <span className="text-slate-500 text-xs">📍 {q.pincode}</span>
                      )}
                      {q.target && (
                        <span className="text-slate-500 text-xs">🏢 {q.target}</span>
                      )}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                    onClick={() => deleteQuery(i)}
                    title="Remove this query"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {queries.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-14 h-14 bg-slate-700 rounded-full flex items-center justify-center text-2xl">🗑️</div>
                <div className="text-center">
                  <p className="text-slate-300 font-medium">All queries removed</p>
                  <p className="text-slate-500 text-sm mt-1">Regenerate to start fresh</p>
                </div>
                <button className="btn-primary px-8" onClick={generateQueries}>
                  Regenerate Queries
                </button>
                <button className="btn-ghost text-sm" onClick={onBack}>
                  ← Go back and change settings
                </button>
              </div>
            )}
          </div>

          {queries.length > 10 && (
            <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 mb-4">
              <p className="text-yellow-300 text-sm">
                ⚠️ {queries.length} queries will take a while. You can delete some above.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-ghost" onClick={onBack}>← Back</button>
            <button
              className="btn-primary flex-1 py-3"
              disabled={queries.length === 0}
              onClick={onNext}
            >
              Start Scraping ({queries.length} {queries.length === 1 ? 'query' : 'queries'}) →
            </button>
          </div>
        </>
      )}

      {!loading && !error && queries.length === 0 && !formData.querySummary && (
        <div className="flex gap-3 mt-4">
          <button className="btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn-primary flex-1" onClick={generateQueries}>Generate Queries</button>
        </div>
      )}
    </div>
  )
}
