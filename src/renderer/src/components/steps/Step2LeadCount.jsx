export default function Step2LeadCount({ formData, update, onNext, onBack }) {
  const options = [
    {
      value: 'single',
      label: '1 Lead',
      desc: 'Find a single company or type in a specific area',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      value: 'multiple',
      label: 'Multiple Leads',
      desc: 'Find many companies across various areas and pincodes',
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3z" />
        </svg>
      )
    }
  ]

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">How many leads?</h1>
        <p className="text-slate-400 mt-1">Are you searching for a single lead or multiple?</p>
      </div>

      <div className="space-y-3 mb-6">
        {options.map(opt => (
          <div
            key={opt.value}
            className={`option-card flex items-start gap-4 ${
              formData.leadCount === opt.value ? 'option-card-active' : 'option-card-inactive'
            }`}
            onClick={() => update({ leadCount: opt.value })}
          >
            <div className={`mt-0.5 ${formData.leadCount === opt.value ? 'text-blue-400' : 'text-slate-500'}`}>
              {opt.icon}
            </div>
            <div>
              <div className="font-semibold text-white">{opt.label}</div>
              <div className="text-slate-400 text-sm mt-0.5">{opt.desc}</div>
            </div>
            <div className="ml-auto mt-1">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                formData.leadCount === opt.value ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
              }`}>
                {formData.leadCount === opt.value && (
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
          disabled={!formData.leadCount}
          onClick={onNext}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
