import { useState } from 'react'

const COMMON_TYPES = [
  'Software company', 'IT company', 'Warehouse', 'Logistics',
  'Manufacturing', 'Hospital', 'Hotel', 'Restaurant',
  'School', 'Pharmacy', 'Retail store', 'Construction'
]

// ── Single lead mode ─────────────────────────────────────────────────────────
function SingleCompanyForm({ formData, update, onNext, onBack }) {
  const [input, setInput] = useState(formData.companies[0] || '')

  const handleContinue = () => {
    const value = input.trim()
    if (!value) return
    update({ hasCompanyList: true, companies: [value], companyTypes: [] })
    onNext()
  }

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Which business?</h1>
        <p className="text-slate-400 mt-1">Enter the exact business name you want to find</p>
      </div>

      <div className="step-card">
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Business name</label>
        <input
          className="input-field"
          placeholder="e.g. Infosys, Tata Consultancy Services"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && input.trim() && handleContinue()}
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-2">
          We'll search Google Maps for this exact business name and return the best match.
        </p>
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1" disabled={!input.trim()} onClick={handleContinue}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ── Multiple leads mode ───────────────────────────────────────────────────────
function MultipleCompanyForm({ formData, update, onNext, onBack }) {
  const [inputValue, setInputValue] = useState('')

  const isListMode = formData.hasCompanyList === true
  const isTypeMode = formData.hasCompanyList === false
  const currentItems = isListMode ? formData.companies : isTypeMode ? formData.companyTypes : []

  const addItems = (raw) => {
    const items = raw.split(',').map(s => s.trim()).filter(Boolean)
    if (isListMode) {
      update({ companies: [...new Set([...formData.companies, ...items])] })
    } else {
      update({ companyTypes: [...new Set([...formData.companyTypes, ...items])] })
    }
    setInputValue('')
  }

  const removeItem = (item) => {
    if (isListMode) update({ companies: formData.companies.filter(c => c !== item) })
    else update({ companyTypes: formData.companyTypes.filter(c => c !== item) })
  }

  const canContinue = formData.hasCompanyList !== null && currentItems.length > 0

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Which companies?</h1>
        <p className="text-slate-400 mt-1">Tell us what you're looking for</p>
      </div>

      <div className="step-card mb-4">
        <p className="text-sm font-medium text-slate-300 mb-3">Do you have a specific list of companies?</p>
        <div className="flex gap-3">
          {[
            { val: true,  label: 'Yes, I have a list' },
            { val: false, label: 'No, search by type' }
          ].map(opt => (
            <button
              key={String(opt.val)}
              className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${
                formData.hasCompanyList === opt.val
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
              onClick={() => update({ hasCompanyList: opt.val, companies: [], companyTypes: [] })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {formData.hasCompanyList !== null && (
        <div className="step-card mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {isListMode
              ? 'Company names — separate multiple with commas'
              : 'Company types — e.g. Warehouse, Software company, Logistics'}
          </label>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder={isListMode ? 'TCS, Infosys, Wipro' : 'Software company, Warehouse'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inputValue.trim() && addItems(inputValue)}
            />
            <button className="btn-primary" disabled={!inputValue.trim()} onClick={() => addItems(inputValue)}>
              Add
            </button>
          </div>

          {currentItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {currentItems.map(item => (
                <span key={item} className="tag">
                  {item}
                  <button className="ml-1 text-blue-400 hover:text-red-400 transition-colors" onClick={() => removeItem(item)}>×</button>
                </span>
              ))}
            </div>
          )}

          {!isListMode && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-2">Common types:</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_TYPES.map(t => (
                  <button
                    key={t}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      formData.companyTypes.includes(t)
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                    }`}
                    onClick={() => {
                      if (formData.companyTypes.includes(t)) {
                        update({ companyTypes: formData.companyTypes.filter(c => c !== t) })
                      } else {
                        update({ companyTypes: [...formData.companyTypes, t] })
                      }
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary flex-1" disabled={!canContinue} onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function Step3Company({ formData, update, onNext, onBack }) {
  if (formData.leadCount === 'single') {
    return <SingleCompanyForm formData={formData} update={update} onNext={onNext} onBack={onBack} />
  }
  return <MultipleCompanyForm formData={formData} update={update} onNext={onNext} onBack={onBack} />
}
