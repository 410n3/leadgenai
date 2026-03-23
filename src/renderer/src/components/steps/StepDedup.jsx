import { useState, useEffect } from 'react'

function extractDomain(url) {
  if (!url) return ''
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return url.toLowerCase().trim() }
}

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '').slice(-10)
}

function normalizeName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function deduplicateLeads(leads) {
  const seenPhones  = new Set()
  const seenDomains = new Set()
  const seenNames   = new Set()
  const unique      = []
  const removed     = []

  for (const lead of leads) {
    const phone  = normalizePhone(lead.phone)
    const domain = extractDomain(lead.website)
    const name   = normalizeName(lead.name)

    const reasons = []
    if (phone  && seenPhones.has(phone))   reasons.push('same phone')
    if (domain && seenDomains.has(domain)) reasons.push('same website')
    if (name   && seenNames.has(name))     reasons.push('same name')

    if (reasons.length > 0) {
      removed.push({ ...lead, _dupReasons: reasons })
    } else {
      if (phone)  seenPhones.add(phone)
      if (domain) seenDomains.add(domain)
      if (name)   seenNames.add(name)
      unique.push(lead)
    }
  }

  return { unique, removed }
}

export default function StepDedup({ formData, update, onNext, onBack }) {
  const [unique,  setUnique]  = useState([])
  const [removed, setRemoved] = useState([])
  const [showRemoved, setShowRemoved] = useState(false)

  useEffect(() => {
    const { unique: u, removed: r } = deduplicateLeads(formData.leads)
    setUnique(u)
    setRemoved(r)
    update({ uniqueLeads: u })
  }, [])

  const restore = (lead) => {
    const newRemoved = removed.filter(l => l !== lead)
    const newUnique  = [...unique, { ...lead, _dupReasons: undefined }]
    setRemoved(newRemoved)
    setUnique(newUnique)
    update({ uniqueLeads: newUnique })
  }

  const handleContinue = () => {
    update({ uniqueLeads: unique })
    onNext()
  }

  return (
    <div className="max-w-2xl mx-auto pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Remove Duplicates</h1>
        <p className="text-slate-400 mt-1">
          Matched by phone number, website domain, or company name
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total scraped', value: formData.leads.length, color: 'bg-slate-700' },
          { label: 'Duplicates removed', value: removed.length, color: 'bg-red-900/40 border border-red-700/40' },
          { label: 'Unique leads', value: unique.length, color: 'bg-green-900/40 border border-green-700/40' }
        ].map(card => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 text-center`}>
            <p className="text-3xl font-bold text-white">{card.value}</p>
            <p className="text-slate-400 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Duplicate rules explanation */}
      <div className="card mb-4">
        <p className="text-slate-400 text-sm font-medium mb-2">Duplicate detection rules:</p>
        <div className="space-y-1 text-sm text-slate-500">
          <div className="flex items-center gap-2"><span className="text-blue-400">📞</span> Same phone number (last 10 digits)</div>
          <div className="flex items-center gap-2"><span className="text-blue-400">🌐</span> Same website domain (ignoring www)</div>
          <div className="flex items-center gap-2"><span className="text-blue-400">🏢</span> Exact same company name</div>
        </div>
      </div>

      {/* Removed list */}
      {removed.length > 0 && (
        <div className="card mb-4">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowRemoved(v => !v)}
          >
            <span className="text-slate-300 font-medium text-sm">
              {removed.length} duplicate{removed.length > 1 ? 's' : ''} removed
            </span>
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${showRemoved ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRemoved && (
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {removed.map((lead, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-sm font-medium truncate">{lead.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead._dupReasons.map(r => (
                        <span key={r} className="text-xs text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded">
                          {r}
                        </span>
                      ))}
                      {lead.phone && <span className="text-slate-600 text-xs">{lead.phone}</span>}
                    </div>
                  </div>
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => restore(lead)}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {removed.length === 0 && (
        <div className="card mb-4 text-center py-6">
          <p className="text-green-400 font-medium">✓ No duplicates found</p>
          <p className="text-slate-500 text-sm mt-1">All {formData.leads.length} leads are unique</p>
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1 py-3" onClick={handleContinue}>
          Continue with {unique.length} unique leads →
        </button>
      </div>
    </div>
  )
}
