import { useState, useEffect, useRef } from 'react'

const TIER_BADGE = {
  1: 'bg-yellow-500/20 text-yellow-300 border border-yellow-600/40',
  2: 'bg-blue-500/20 text-blue-300 border border-blue-600/40',
  3: 'bg-slate-700 text-slate-400 border border-slate-600/40'
}

export default function StepResults({ formData, onReset }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('tier')
  const [tierFilter, setTierFilter] = useState('all')
  const [exportMsg, setExportMsg] = useState('')
  const [sheetSaved, setSheetSaved] = useState(false)
  const hasSaved = useRef(false)

  const leads = formData.tieredLeads || formData.uniqueLeads || formData.leads || []

  // Auto-save final tiered+enriched leads to Google Sheets once
  useEffect(() => {
    if (hasSaved.current || leads.length === 0) return
    hasSaved.current = true
    window.api.saveLeads({ leads, sessionId: formData.sessionId })
      .then(() => setSheetSaved(true))
      .catch(err => console.error('Sheet save error:', err))
  }, [])

  const counts = { 1: 0, 2: 0, 3: 0 }
  leads.forEach(l => { if (l.tier) counts[l.tier]++ })

  const filtered = leads
    .filter(l => {
      if (tierFilter !== 'all' && String(l.tier) !== tierFilter) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.fullAddress || l.address || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q)
      )
    })
    .sort((a, b) => {
      if (sortKey === 'tier') return (a.tier || 3) - (b.tier || 3)
      const av = (a[sortKey] || '').toLowerCase()
      const bv = (b[sortKey] || '').toLowerCase()
      return av < bv ? -1 : av > bv ? 1 : 0
    })

  const handleExportCsv = async () => {
    const result = await window.api.exportCsv({ leads: filtered })
    if (result.success) {
      setExportMsg(`✅ Saved: ${result.filePath}`)
      setTimeout(() => setExportMsg(''), 4000)
    }
  }

  const handleOpenSheets = async () => {
    const url = await window.api.getSheetUrl()
    await window.api.openExternal(url)
  }

  return (
    <div className="max-w-5xl mx-auto pt-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Results</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {leads.length} leads · {filtered.length} shown
            {sheetSaved && <span className="ml-2 text-green-400 text-xs">· ✅ Saved to Sheets</span>}
            {!sheetSaved && <span className="ml-2 text-slate-500 text-xs animate-pulse">· Saving to Sheets...</span>}
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={onReset}>Start New Search</button>
      </div>

      {/* Tier summary pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: `All  ${leads.length}` },
          { key: '1', label: `T1 · ${counts[1]}  Hot` },
          { key: '2', label: `T2 · ${counts[2]}  Warm` },
          { key: '3', label: `T3 · ${counts[3]}  Cold` }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setTierFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${tierFilter === f.key
              ? 'border-blue-500 bg-blue-500/10 text-blue-300'
              : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className="input-field w-56"
          placeholder="Search leads..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input-field w-40" value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="tier">Sort: Tier</option>
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <button className="btn-secondary text-sm" onClick={handleOpenSheets}>📊 Sheets</button>
          <button className="btn-primary text-sm" onClick={handleExportCsv}>⬇️ Export CSV</button>
        </div>
      </div>

      {exportMsg && (
        <div className="bg-green-900/30 border border-green-700/50 text-green-300 rounded-lg px-4 py-2 text-sm mb-3">
          {exportMsg}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium w-8">#</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium w-16">Tier</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Company</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Type</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Address</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Phone</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Website</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">⭐</th>
                <th className="text-left px-3 py-2.5 text-slate-400 font-medium">Reviews</th>
                <th className="text-left px-3 py-2.5 text-purple-400 font-medium">CIN</th>
                <th className="text-left px-3 py-2.5 text-green-400 font-medium">Revenue</th>
                <th className="text-left px-3 py-2.5 text-blue-400 font-medium">Decision Maker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.map((lead, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-3 py-2.5 text-slate-600 text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[lead.tier] || TIER_BADGE[3]}`}>
                      T{lead.tier || 3}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white font-medium max-w-[160px]">
                    <div className="truncate" title={lead.name}>{lead.name || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 max-w-[110px]">
                    <div className="truncate text-xs" title={lead.category}>{lead.category || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 max-w-[180px]">
                    <div className="truncate text-xs" title={lead.fullAddress || lead.address}>
                      {lead.fullAddress || lead.address || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    {lead.phone
                      ? <span className="text-blue-400">{lead.phone}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 max-w-[140px]">
                    {lead.website
                      ? <button
                        className="text-blue-400 hover:underline text-xs truncate block"
                        onClick={() => window.api.openExternal(lead.website)}
                        title={lead.website}
                      >
                        {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 28)}
                      </button>
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-yellow-400 text-xs whitespace-nowrap">
                    {lead.rating || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {lead.reviewCount > 0
                      ? <span className={lead.reviewCount >= 500 ? 'text-yellow-400' : lead.reviewCount >= 50 ? 'text-blue-400' : 'text-slate-500'}>
                        {lead.reviewCount.toLocaleString()}
                      </span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {lead.mcaData?.cinNumber
                      ? <span className="text-purple-300 font-mono">{lead.mcaData.cinNumber}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {lead.mcaData?.googleRevenue != null ? (
                      <span className={lead.mcaData.googleRevenue >= 500_000_000 ? 'text-yellow-400 font-medium' : lead.mcaData.googleRevenue >= 100_000_000 ? 'text-blue-400 font-medium' : 'text-slate-400'}>
                        🔍 ₹{lead.mcaData.googleRevenue >= 10_000_000
                          ? `${(lead.mcaData.googleRevenue / 10_000_000).toFixed(1)} Cr`
                          : `${(lead.mcaData.googleRevenue / 100_000).toFixed(1)} L`}
                      </span>
                    ) : lead.mcaData?.paidUpCapital != null ? (
                      <span className={lead.mcaData.paidUpCapital >= 10_000_000 ? 'text-yellow-400 font-medium' : lead.mcaData.paidUpCapital >= 1_000_000 ? 'text-blue-400 font-medium' : 'text-slate-400'}>
                        🏛️ ₹{lead.mcaData.paidUpCapital >= 10_000_000
                          ? `${(lead.mcaData.paidUpCapital / 10_000_000).toFixed(1)} Cr`
                          : lead.mcaData.paidUpCapital >= 100_000
                            ? `${(lead.mcaData.paidUpCapital / 100_000).toFixed(1)} L`
                            : lead.mcaData.paidUpCapital.toLocaleString('en-IN')}
                      </span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs min-w-[150px]">
                    {lead.googleContacts && lead.googleContacts.length > 0 ? (
                      <div className="space-y-3">
                        {lead.googleContacts.map((contact, idx) => (
                          <div key={idx}>
                            {contact.name ? (
                              <div className="font-medium text-white mb-0.5 flex items-center gap-1.5">
                                {contact.name}
                                {contact.verified === true && (
                                  <span className="text-[10px] bg-green-700 text-green-200 px-1.5 py-0.5 rounded font-semibold">Verified</span>
                                )}
                                {contact.verified === false && (
                                  <span className="text-[10px] bg-yellow-700 text-yellow-200 px-1.5 py-0.5 rounded font-semibold">Unverified</span>
                                )}
                              </div>
                            ) : null}
                            {contact.linkedinUrl ? (
                              <button
                                className="text-blue-400 hover:underline flex items-center gap-1"
                                onClick={() => window.api.openExternal(contact.linkedinUrl)}
                              >
                                <svg className="w-3 h-3 block" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                LinkedIn Profile
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500">
              No leads match the current filter
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 text-center">
        <button className="btn-primary px-10" onClick={onReset}>Start New Search</button>
      </div>
    </div>
  )
}
