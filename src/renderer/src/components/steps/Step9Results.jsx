import { useState } from 'react'

export default function Step9Results({ formData, onReset }) {
  const [exportMsg, setExportMsg] = useState('')
  const [sheetMsg, setSheetMsg] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('name')

  const leads = formData.leads || []

  const filtered = leads
    .filter(l => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.fullAddress || l.address || '').toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const av = (a[sortKey] || '').toLowerCase()
      const bv = (b[sortKey] || '').toLowerCase()
      return av < bv ? -1 : av > bv ? 1 : 0
    })

  const handleExportCsv = async () => {
    const result = await window.api.exportCsv({ leads })
    if (result.success) {
      setExportMsg(`Saved: ${result.filePath}`)
      setTimeout(() => setExportMsg(''), 4000)
    }
  }

  const handleOpenSheets = async () => {
    const url = await window.api.getSheetUrl()
    await window.api.openExternal(url)
    setSheetMsg('Opened in browser')
    setTimeout(() => setSheetMsg(''), 2000)
  }

  const handleOpenWebsite = (url) => {
    if (url) window.api.openExternal(url)
  }

  return (
    <div className="max-w-5xl mx-auto pt-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Results</h1>
          <p className="text-slate-400 mt-1">
            Found <span className="text-white font-bold">{leads.length}</span> businesses
            {filtered.length !== leads.length && ` (${filtered.length} shown)`}
          </p>
        </div>
        <button className="btn-ghost text-sm" onClick={onReset}>Start New Search</button>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="input-field w-64"
          placeholder="Search results..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input-field w-40"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
        >
          <option value="name">Sort: Name</option>
          <option value="category">Sort: Category</option>
          <option value="fullAddress">Sort: Address</option>
        </select>
        <div className="flex gap-2 ml-auto">
          <button className="btn-secondary text-sm" onClick={handleOpenSheets}>
            📊 View in Sheets
          </button>
          <button className="btn-primary text-sm" onClick={handleExportCsv}>
            ⬇️ Export CSV
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="bg-green-900/30 border border-green-700/50 text-green-300 rounded-lg px-4 py-2 text-sm mb-3">
          ✅ {exportMsg}
        </div>
      )}
      {sheetMsg && (
        <div className="bg-blue-900/30 border border-blue-700/50 text-blue-300 rounded-lg px-4 py-2 text-sm mb-3">
          {sheetMsg}
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium w-8">#</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Company Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Address</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Phone</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Website</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((lead, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-medium max-w-[180px]">
                      <div className="truncate" title={lead.name}>{lead.name || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[120px]">
                      <div className="truncate" title={lead.category}>{lead.category || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px]">
                      <div className="truncate text-xs" title={lead.fullAddress || lead.address}>
                        {lead.fullAddress || lead.address || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="text-blue-400 hover:underline text-xs">
                          {lead.phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      {lead.website ? (
                        <button
                          className="text-blue-400 hover:underline text-xs truncate block"
                          onClick={() => handleOpenWebsite(lead.website)}
                          title={lead.website}
                        >
                          {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30)}
                          {lead.website.length > 30 ? '...' : ''}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-yellow-400 text-xs whitespace-nowrap">
                      {lead.rating ? `⭐ ${lead.rating}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="step-card text-center py-12">
          <p className="text-slate-400 text-lg">No results found</p>
          {search && <p className="text-slate-500 text-sm mt-1">Try clearing your search filter</p>}
        </div>
      )}

      <div className="mt-6 text-center">
        <button className="btn-primary px-8" onClick={onReset}>
          Start New Search
        </button>
      </div>
    </div>
  )
}
