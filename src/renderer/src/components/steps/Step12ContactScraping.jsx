import { useState, useEffect, useRef } from 'react'

export default function Step12ContactScraping({ formData, update, onNext, onBack }) {
    const [progress, setProgress] = useState({ status: 'Starting LinkedIn search...', message: '' })
    const [done, setDone] = useState(false)
    const [error, setError] = useState('')
    const hasStarted = useRef(false)
    const cleanupRef = useRef(null)

    const leads = formData.tieredLeads || []
    const targetLeads = leads.filter(l => l.tier === 1 || l.tier === 2)

    useEffect(() => {
        if (hasStarted.current) return
        hasStarted.current = true

        cleanupRef.current = window.api.onContactProgress((data) => {
            setProgress(data)
        })

        const config = formData.googleContactConfig || {}
        const inputs = {
            jobTitles: config.jobTitles,
            location: config.location,
            useApify: config.useApify,
            maxItemsPerCompany: config.maxResults || 3,
            leads: targetLeads
        }

        window.api.runGoogleContacts(inputs).then((result) => {
            const items = result.items || []
            const updatedLeads = leads.map(lead => {
                const match = items.find(item => item.name === lead.name)
                if (match && match.googleContacts) return { ...lead, googleContacts: match.googleContacts }
                return lead
            })
            update({ tieredLeads: updatedLeads })
            setDone(true)
        }).catch((e) => {
            setError(e.message || 'LinkedIn contact search failed')
            setDone(true)
        })

        return () => { if (cleanupRef.current) cleanupRef.current() }
    }, [])

    return (
        <div className="max-w-2xl mx-auto pt-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">
                    {done ? (error ? 'Contact Search Failed' : 'Contact Search Complete!') : 'Finding LinkedIn Contacts...'}
                </h1>
                <p className="text-slate-400 mt-1">
                    {done
                        ? 'Proceed to view your final leads.'
                        : 'Searching LinkedIn profiles via Google. This may take a few minutes.'}
                </p>
            </div>

            <div className="step-card mb-4">
                {!done && !error && (
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                        <div>
                            <p className="text-white font-medium">{progress.status}</p>
                            {progress.message && progress.message !== progress.status && (
                                <p className="text-slate-400 text-sm">{progress.message}</p>
                            )}
                        </div>
                    </div>
                )}
                {done && !error && (
                    <div className="flex items-start gap-4">
                        <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-xl shrink-0">✓</div>
                        <p className="text-white font-medium">LinkedIn profiles extracted</p>
                    </div>
                )}
                {error && (
                    <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
                        <p className="text-red-300 font-medium">Search failed</p>
                        <p className="text-red-400 text-sm mt-1">{error}</p>
                        <p className="text-slate-400 text-xs mt-2">Check your internet connection and try again.</p>
                    </div>
                )}
            </div>

            <div className="flex gap-3">
                {!done && (
                    <button className="btn-ghost" onClick={onNext}>Skip & View Results</button>
                )}
                {done && (
                    <button className="btn-primary flex-1 py-3" onClick={onNext}>View Final Results →</button>
                )}
            </div>
        </div>
    )
}
