import { useState } from 'react'

export default function Step11ContactFinder({ formData, update, onNext, onBack }) {
    const [jobTitles, setJobTitles] = useState('ehs head, ehs officer, security officer')
    const [searchMode, setSearchMode] = useState('google') // 'google' or 'apify'
    const [maxResults, setMaxResults] = useState(3)

    // Use state + country only — city/district values can be neighborhoods (e.g. "Whitefield")
    // that don't appear on LinkedIn profiles, causing the dork to miss results
    const locationParts = [formData.state, formData.country].filter(Boolean)
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'India'

    const handleNext = () => {
        update({
            googleContactConfig: {
                jobTitles,
                location,
                useApify: searchMode === 'apify',
                maxResults
            }
        })
        onNext()
    }

    // Count how many T1/T2 leads we have
    const leads = formData.tieredLeads || formData.uniqueLeads || []
    const targetLeads = leads.filter(l => l.tier === 1 || l.tier === 2)

    return (
        <div className="max-w-2xl mx-auto pt-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Find Contacts via AI</h1>
                <p className="text-slate-400 mt-1">
                    Securely use Google AI and your Local ML model to discover decision makers for your Tier 1 and Tier 2 companies.
                </p>
            </div>

            <div className="step-card mb-4 min-h-[300px]">
                <div className="mb-6 p-4 rounded-xl bg-violet-900/20 border border-violet-700/40">
                    <p className="text-slate-300 text-sm">
                        We found <span className="font-bold text-white">{targetLeads.length}</span> Tier 1 & 2 companies out of your {leads.length} total leads.
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                        We will use their websites and names to find the specific decision makers.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-3">🔍 Search Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${searchMode === 'google'
                                    ? 'bg-violet-600/20 border-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                onClick={() => setSearchMode('google')}
                            >
                                <span>Google X-Ray</span>
                                <span className="text-[10px] opacity-60">Free • site:linkedin.com</span>
                            </button>
                            <button
                                className={`p-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${searchMode === 'apify'
                                    ? 'bg-violet-600/20 border-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]'
                                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                onClick={() => setSearchMode('apify')}
                            >
                                <span>Apify Actor</span>
                                <span className="text-[10px] opacity-60">Paid • ~$0.10 per run</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">👔 Job Titles</label>
                        <input
                            className="input-field"
                            value={jobTitles}
                            onChange={e => setJobTitles(e.target.value)}
                            placeholder="e.g. ehs head, ehs officer"
                        />
                        <p className="text-xs text-slate-500 mt-1">Comma-separated list of target roles.</p>
                    </div>

                    <div className="pt-2 border-t border-slate-700/50 mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-300">👥 Max Decision Makers per Company</label>
                            <span className="text-violet-400 font-bold bg-violet-400/10 px-2 py-0.5 rounded text-xs">{maxResults} per company</span>
                        </div>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(num => (
                                <button
                                    key={num}
                                    className={`flex-1 py-2 rounded-lg border text-sm transition-all ${maxResults === num
                                        ? 'bg-violet-600 border-violet-500 text-white shadow-lg'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                        }`}
                                    onClick={() => setMaxResults(num)}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 italic">
                            {searchMode === 'apify' 
                                ? "Apify: Each company search counts towards your credits. Higher count = more profiles." 
                                : "Google: Higher counts may increase the chance of getting rate-limited."}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                <button className="btn-ghost" onClick={onBack}>← Back</button>
                <button
                    className="btn-primary flex-1 py-3"
                    onClick={handleNext}
                    disabled={targetLeads.length === 0}
                >
                    {targetLeads.length > 0 ? `Find Contacts (${targetLeads.length} companies) →` : 'No Tier 1/2 Leads Available'}
                </button>
            </div>
        </div >
    )
}
