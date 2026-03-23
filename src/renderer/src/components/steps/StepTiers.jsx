import { useState, useEffect } from 'react'

const TIER_CONFIG = {
  1: {
    label: 'Tier 1',
    sublabel: 'High Revenue',
    color: 'text-yellow-300',
    bg: 'bg-yellow-900/20 border-yellow-700/40',
    badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-600/40',
    dot: 'bg-yellow-400',
    barColor: 'bg-yellow-500'
  },
  2: {
    label: 'Tier 2',
    sublabel: 'Mid Revenue',
    color: 'text-blue-300',
    bg: 'bg-blue-900/20 border-blue-700/40',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-600/40',
    dot: 'bg-blue-400',
    barColor: 'bg-blue-500'
  },
  3: {
    label: 'Tier 3',
    sublabel: 'Low Revenue',
    color: 'text-slate-400',
    bg: 'bg-slate-800/50 border-slate-700/40',
    badge: 'bg-slate-700 text-slate-400 border border-slate-600/40',
    dot: 'bg-slate-500',
    barColor: 'bg-slate-500'
  }
}

function classifyLead(lead, t1, t2) {
  // Priority 0: Google revenue
  const gr = lead.mcaData?.googleRevenue
  if (gr != null) {
    if (gr >= t1) return 1
    if (gr >= t2) return 2
    return 3
  }
  // Priority 1: MCA paid-up capital
  const cap = lead.mcaData?.paidUpCapital
  if (cap !== undefined && cap !== null) {
    if (cap >= t1) return 1
    if (cap >= t2) return 2
    return 3
  }
  // Fallback: review count
  const reviews = lead.reviewCount || 0
  if (reviews >= 500) return 1
  if (reviews >= 50) return 2
  return 3
}

function crDisplay(rupees) {
  return rupees >= 10_000_000
    ? `₹${(rupees / 10_000_000).toFixed(0)} Cr`
    : `₹${(rupees / 100_000).toFixed(0)} L`
}

export default function StepTiers({ formData, update, onNext, onBack }) {
  const [tiered, setTiered] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  // Capital thresholds in rupees (loaded from settings)
  const [t1, setT1] = useState(500_000_000)   // default ₹50 Cr
  const [t2, setT2] = useState(100_000_000)   // default ₹10 Cr

  useEffect(() => {
    window.api.getTierSettings().then(s => {
      const newT1 = Math.round(s.tier1Crores * 10_000_000)
      const newT2 = Math.round(s.tier2Crores * 10_000_000)
      setT1(newT1)
      setT2(newT2)
      const source = formData.enrichedLeads?.length ? formData.enrichedLeads : formData.uniqueLeads
      const classified = source.map(lead => ({ ...lead, tier: classifyLead(lead, newT1, newT2) }))
      setTiered(classified)
      update({ tieredLeads: classified })
    }).catch(() => {
      const source = formData.enrichedLeads?.length ? formData.enrichedLeads : formData.uniqueLeads
      const classified = source.map(lead => ({ ...lead, tier: classifyLead(lead, t1, t2) }))
      setTiered(classified)
      update({ tieredLeads: classified })
    })
  }, [])

  const changeTier = (index, newTier) => {
    const updated = tiered.map((l, i) => i === index ? { ...l, tier: newTier } : l)
    setTiered(updated)
    update({ tieredLeads: updated })
  }

  const counts = { 1: 0, 2: 0, 3: 0 }
  tiered.forEach(l => { if (l.tier) counts[l.tier]++ })

  const displayLeads = activeTab === 'all'
    ? tiered
    : tiered.filter(l => l.tier === Number(activeTab))

  const total = tiered.length

  return (
    <div className="max-w-3xl mx-auto pt-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Revenue Tier Classification</h1>
        <p className="text-slate-400 mt-1">
          MCA-registered companies classified by paid-up capital · Others by Google Maps review count
        </p>
      </div>

      {/* Tier summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[1, 2, 3].map(t => {
          const cfg = TIER_CONFIG[t]
          const pct = total > 0 ? Math.round((counts[t] / total) * 100) : 0
          return (
            <div key={t} className={`border rounded-xl p-4 ${cfg.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</span>
                <span className="text-slate-500 text-xs ml-auto">{pct}%</span>
              </div>
              <p className="text-3xl font-bold text-white">{counts[t] || 0}</p>
              <p className={`text-sm font-medium mt-1 ${cfg.color}`}>{cfg.sublabel}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {t === 1 ? `≥${crDisplay(t1)} paid-up · or 500+ reviews`
                  : t === 2 ? `${crDisplay(t2)}–${crDisplay(t1 - 1)} · or 50–499 reviews`
                    : `<${crDisplay(t2)} · or <50 reviews`}
              </p>
              {/* Mini bar */}
              <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cfg.barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="card mb-4 flex gap-6 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400" /><span>Tier 1 — ≥{crDisplay(t1)} paid-up · or 500+ reviews</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-400" /><span>Tier 2 — {crDisplay(t2)}–{crDisplay(t1 - 1)} · or 50–499 reviews</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-500" /><span>Tier 3 — &lt;{crDisplay(t2)} · or &lt;50 reviews</span></div>
        <span className="ml-auto text-slate-600 italic">Hover a row to manually reassign</span>
      </div>

      {/* Tab filter */}
      <div className="flex gap-1 mb-3 bg-slate-800 p-1 rounded-lg w-fit">
        {[
          { key: 'all', label: `All (${total})` },
          { key: '1', label: `T1 · ${counts[1] || 0}` },
          { key: '2', label: `T2 · ${counts[2] || 0}` },
          { key: '3', label: `T3 · ${counts[3] || 0}` }
        ].map(tab => (
          <button
            key={tab.key}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
              }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leads list */}
      <div className="card mb-4">
        <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
          {displayLeads.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">No leads in this tier</p>
          )}
          {displayLeads.map((lead) => {
            const globalIdx = tiered.indexOf(lead)
            const cfg = TIER_CONFIG[lead.tier]
            return (
              <div key={globalIdx} className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-3 py-2.5 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-slate-200 text-sm font-medium truncate">{lead.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {lead.mcaData?.revenueSource === 'google' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-300 border border-green-600/40 shrink-0">
                        Google
                      </span>
                    )}
                    {lead.mcaData?.mcaFound && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-300 border border-purple-600/40 shrink-0">
                        MCA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
                    {lead.mcaData?.googleRevenue != null ? (
                      <span className={`font-medium ${lead.mcaData.googleRevenue >= t1 ? 'text-yellow-400' : lead.mcaData.googleRevenue >= t2 ? 'text-blue-400' : 'text-slate-400'}`}>
                        🔍 Revenue: ₹{lead.mcaData.googleRevenue >= 10_000_000
                          ? `${(lead.mcaData.googleRevenue / 10_000_000).toFixed(1)} Cr`
                          : `${(lead.mcaData.googleRevenue / 100_000).toFixed(1)} L`}
                      </span>
                    ) : lead.mcaData?.mcaFound && lead.mcaData.paidUpCapital != null ? (
                      <span className={`font-medium ${lead.mcaData.paidUpCapital >= t1 ? 'text-yellow-400' : lead.mcaData.paidUpCapital >= t2 ? 'text-blue-400' : 'text-slate-400'}`}>
                        🏛️ Paid-up: ₹{lead.mcaData.paidUpCapital >= 10_000_000
                          ? `${(lead.mcaData.paidUpCapital / 10_000_000).toFixed(1)} Cr`
                          : lead.mcaData.paidUpCapital >= 100_000
                            ? `${(lead.mcaData.paidUpCapital / 100_000).toFixed(1)} L`
                            : lead.mcaData.paidUpCapital.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className={`font-medium ${lead.reviewCount >= 500 ? 'text-yellow-400' : lead.reviewCount >= 50 ? 'text-blue-400' : 'text-slate-500'}`}>
                        ⭐ {lead.reviewCount > 0 ? `${lead.reviewCount.toLocaleString()} reviews` : 'No reviews'}
                      </span>
                    )}
                    {lead.rating && <span>· {lead.rating}</span>}
                    {lead.category && <span>· {lead.category}</span>}
                    {lead.phone && <span>📞 {lead.phone}</span>}
                  </div>
                </div>

                {/* Manual tier reassignment — shown on hover */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {[1, 2, 3].map(t => (
                    <button
                      key={t}
                      className={`w-6 h-6 rounded text-xs font-bold transition-all ${lead.tier === t
                          ? `${TIER_CONFIG[t].dot} text-white`
                          : 'bg-slate-700 text-slate-500 hover:bg-slate-600'
                        }`}
                      onClick={() => changeTier(globalIdx, t)}
                      title={`Move to ${TIER_CONFIG[t].label}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1 py-3" onClick={onNext}>
          Find Contacts ({total} leads) →
        </button>
      </div>
    </div>
  )
}
