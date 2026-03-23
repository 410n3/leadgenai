import { useState, useEffect } from 'react'
import { STATES, getDistricts, getCities } from '../../data/indiaLocations'

export default function Step4Location({ formData, update, onNext, onBack }) {
  const [cityInput, setCityInput] = useState(formData.city)

  const districts = getDistricts(formData.state)
  const suggestedCities = getCities(formData.state, formData.district)

  useEffect(() => {
    setCityInput(formData.city)
  }, [formData.city])

  const isValid = formData.state && formData.district && (formData.city || cityInput.trim())

  const handleStateChange = (e) => {
    const state = e.target.value
    update({ state, district: '', city: '' })
    setCityInput('')
  }

  const handleDistrictChange = (e) => {
    const district = e.target.value
    update({ district, city: '' })
    setCityInput('')
  }

  return (
    <div className="max-w-lg mx-auto pt-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Where to search?</h1>
        <p className="text-slate-400 mt-1">Select your target location</p>
      </div>

      <div className="step-card space-y-4">
        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
          <input
            className="input-field"
            value={formData.country}
            onChange={e => update({ country: e.target.value })}
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">State / Union Territory</label>
          <select
            className="input-field"
            value={formData.state}
            onChange={handleStateChange}
          >
            <option value="">-- Select State --</option>
            {STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* District */}
        {formData.state && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">District</label>
            <select
              className="input-field"
              value={formData.district}
              onChange={handleDistrictChange}
            >
              <option value="">-- Select District --</option>
              {districts.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {/* City */}
        {formData.district && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              City / Area / Place
            </label>
            <input
              className="input-field"
              placeholder="e.g. Bangalore, Whitefield, Electronic City"
              value={cityInput}
              onChange={e => {
                setCityInput(e.target.value)
                update({ city: e.target.value })
              }}
            />
            {suggestedCities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestedCities.map(city => (
                  <button
                    key={city}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      cityInput === city
                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                        : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                    }`}
                    onClick={() => {
                      setCityInput(city)
                      update({ city })
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {isValid && (
          <div className="bg-slate-900/50 rounded-lg px-4 py-3 border border-slate-700">
            <p className="text-xs text-slate-500 mb-1">Location preview</p>
            <p className="text-slate-200 font-medium">
              {formData.city || cityInput}, {formData.district}, {formData.state}, {formData.country}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button
          className="btn-primary flex-1"
          disabled={!isValid}
          onClick={() => {
            if (cityInput.trim()) update({ city: cityInput.trim() })
            onNext()
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  )
}
