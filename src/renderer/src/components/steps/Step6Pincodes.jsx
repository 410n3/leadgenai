import { useState } from 'react'

export default function Step6Pincodes({ formData, update, onNext, onBack }) {
  const [inputValue, setInputValue] = useState('')

  const addPincodes = (raw) => {
    const pins = raw.split(',').map(s => s.trim()).filter(s => /^\d{6}$/.test(s))
    const invalid = raw.split(',').map(s => s.trim()).filter(s => s && !/^\d{6}$/.test(s))
    if (pins.length) {
      update({ pincodes: [...new Set([...formData.pincodes, ...pins])] })
    }
    setInputValue('')
    if (invalid.length) {
      return `Invalid pincodes ignored: ${invalid.join(', ')}`
    }
  }

  const removePin = (pin) => {
    update({ pincodes: formData.pincodes.filter(p => p !== pin) })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      addPincodes(inputValue)
    }
  }

  // Calculate how many search queries will be generated
  const targets = formData.hasCompanyList ? formData.companies : formData.companyTypes
  const queryCount = targets.length * Math.max(formData.pincodes.length, 1)

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Pincodes to search</h1>
        <p className="text-slate-400 mt-1">Enter 6-digit pincodes — separate multiple with commas</p>
      </div>

      <div className="step-card space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Pincode(s)
          </label>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="560008 or 560008, 560001, 560100"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
            />
            <button
              className="btn-primary"
              disabled={!inputValue.trim()}
              onClick={() => addPincodes(inputValue)}
            >
              Add
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-1.5">
            Indian pincodes are 6 digits. Separate multiple with commas.
          </p>
        </div>

        {/* Added pincodes */}
        {formData.pincodes.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">{formData.pincodes.length} pincode(s) added:</p>
            <div className="flex flex-wrap gap-2">
              {formData.pincodes.map(pin => (
                <span key={pin} className="tag">
                  📍 {pin}
                  <button
                    className="ml-1 text-blue-400 hover:text-red-400 transition-colors"
                    onClick={() => removePin(pin)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Query count preview */}
        {formData.pincodes.length > 0 && targets.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <p className="text-blue-300 text-sm font-medium">
              This will generate <span className="text-white font-bold">{queryCount}</span> search {queryCount === 1 ? 'query' : 'queries'}
            </p>
            <p className="text-blue-400/70 text-xs mt-0.5">
              {targets.length} {formData.hasCompanyList ? 'company' : 'type'}{targets.length > 1 ? 's' : ''} × {formData.pincodes.length} pincode{formData.pincodes.length > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button
          className="btn-primary flex-1"
          disabled={formData.pincodes.length === 0}
          onClick={onNext}
        >
          Generate Queries →
        </button>
      </div>
    </div>
  )
}
