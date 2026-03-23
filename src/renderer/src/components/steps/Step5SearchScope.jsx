export default function Step5SearchScope({ formData, update, onNext, onBack }) {
  const options = [
    {
      value: 'narrow',
      label: 'Narrow Search',
      desc: 'Search by exact pincode — more precise, fewer results per query',
      example: '"software company near 560008 Bangalore"',
      icon: '🎯'
    },
    {
      value: 'broader',
      label: 'Broader Search',
      desc: 'Search across the city/state area — more results, less pincode-specific',
      example: '"software companies in Bangalore Karnataka"',
      icon: '🔍'
    }
  ]

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Search scope</h1>
        <p className="text-slate-400 mt-1">How targeted should your search be?</p>
      </div>

      <div className="space-y-3 mb-6">
        {options.map(opt => (
          <div
            key={opt.value}
            className={`option-card cursor-pointer ${
              formData.searchScope === opt.value ? 'option-card-active' : 'option-card-inactive'
            }`}
            onClick={() => update({ searchScope: opt.value })}
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-0.5">{opt.icon}</span>
              <div className="flex-1">
                <div className="font-semibold text-white">{opt.label}</div>
                <div className="text-slate-400 text-sm mt-0.5">{opt.desc}</div>
                <div className="text-blue-400 text-xs mt-2 font-mono bg-slate-900/50 px-2 py-1 rounded inline-block">
                  {opt.example}
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 mt-1 flex items-center justify-center transition-all shrink-0 ${
                formData.searchScope === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
              }`}>
                {formData.searchScope === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button
          className="btn-primary flex-1"
          disabled={!formData.searchScope}
          onClick={onNext}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
