import { useState, useEffect } from 'react'
import Step1UserInfo from './components/steps/Step1UserInfo'
import Step2LeadCount from './components/steps/Step2LeadCount'
import Step3Company from './components/steps/Step3Company'
import Step4Location from './components/steps/Step4Location'
import Step5SearchScope from './components/steps/Step5SearchScope'
import Step6Pincodes from './components/steps/Step6Pincodes'
import Step7Preview from './components/steps/Step7Preview'
import Step8Scraping from './components/steps/Step8Scraping'
import StepDedup from './components/steps/StepDedup'
import StepEnrich from './components/steps/StepEnrich'
import StepTiers from './components/steps/StepTiers'
import Step11ContactFinder from './components/steps/Step11ContactFinder'
import Step12ContactScraping from './components/steps/Step12ContactScraping'
import StepResults from './components/steps/StepResults'
import SetupScreen from './components/SetupScreen'
import ProgressSteps from './components/ProgressSteps'
import SettingsModal from './components/SettingsModal'

const STEP = {
  USER_INFO: 0,
  LEAD_COUNT: 1,
  COMPANY: 2,
  LOCATION: 3,
  SEARCH_SCOPE: 4,
  PINCODES: 5,  // skipped when searchScope === 'broader'
  PREVIEW: 6,
  SCRAPING: 7,
  DEDUP: 8,
  ENRICH: 9,
  TIERS: 10,
  CONTACTS_SETUP: 11,
  CONTACTS_SCRAPE: 12,
  RESULTS: 13
}

const TOTAL_STEPS = 14

const STEP_LABELS = [
  'Your Info', 'Count', 'Company', 'Location',
  'Search Scope', 'Pincodes', 'Preview', 'Scraping',
  'Deduplicate', 'MCA Lookup', 'Tier Sort', 'Find Contacts', 'Contact Scrape', 'Results'
]

const initialFormData = {
  name: '',
  email: '',
  sessionId: null,
  leadCount: null,
  hasCompanyList: null,
  companies: [],
  companyTypes: [],
  country: 'India',
  state: '',
  district: '',
  city: '',
  searchScope: 'narrow',
  pincodes: [],
  generatedQueries: [],
  querySummary: '',
  leads: [],          // raw from scraper
  uniqueLeads: [],    // after dedup
  enrichedLeads: [],  // after MCA lookup
  tieredLeads: []     // after tier classification (each lead has .tier 1|2|3)
}

export default function App() {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState(initialFormData)
  const [setupDone, setSetupDone] = useState(null)
  const [setupInfo, setSetupInfo] = useState({})
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.api.checkCredentials()
      .then(info => { setSetupInfo(info); setSetupDone(info.credentialsExist && info.hasApiKey) })
      .catch(() => setSetupDone(false))
  }, [])

  const update = (fields) => setFormData(prev => ({ ...prev, ...fields }))

  const next = () => setStep(cur => {
    if (cur === STEP.SEARCH_SCOPE && formData.searchScope === 'broader') return STEP.PREVIEW
    return Math.min(cur + 1, TOTAL_STEPS - 1)
  })

  const back = () => setStep(cur => {
    if (cur === STEP.PREVIEW && formData.searchScope === 'broader') return STEP.SEARCH_SCOPE
    return Math.max(cur - 1, 0)
  })

  if (setupDone === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-violet-400 text-lg">Loading...</div>
      </div>
    )
  }

  if (!setupDone) {
    return (
      <SetupScreen
        setupInfo={setupInfo}
        onComplete={() => window.api.checkCredentials().then(info => {
          setSetupInfo(info)
          setSetupDone(info.credentialsExist && info.hasApiKey)
        })}
      />
    )
  }

  const skippedSteps = formData.searchScope === 'broader' ? [STEP.PINCODES] : []

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Title bar */}
      <div className="drag-region h-10 flex items-center px-4 shrink-0 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <span className="no-drag text-violet-400 text-xs font-bold tracking-widest uppercase">Pippur</span>
        <div className="ml-auto no-drag">
          <button
            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-300 hover:bg-white/5 transition-all"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Progress bar — hide on final results screen */}
      {step < STEP.RESULTS && (
        <div className="shrink-0 px-8 pb-2 pt-3">
          <ProgressSteps current={step} labels={STEP_LABELS} skipped={skippedSteps} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {step === STEP.USER_INFO && <Step1UserInfo formData={formData} update={update} onNext={next} />}
        {step === STEP.LEAD_COUNT && <Step2LeadCount formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.COMPANY && <Step3Company formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.LOCATION && <Step4Location formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.SEARCH_SCOPE && <Step5SearchScope formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.PINCODES && <Step6Pincodes formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.PREVIEW && <Step7Preview formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.SCRAPING && <Step8Scraping formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.DEDUP && <StepDedup formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.ENRICH && <StepEnrich formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.TIERS && <StepTiers formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.CONTACTS_SETUP && <Step11ContactFinder formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.CONTACTS_SCRAPE && <Step12ContactScraping formData={formData} update={update} onNext={next} onBack={back} />}
        {step === STEP.RESULTS && (
          <StepResults formData={formData} onReset={() => { setFormData({ ...initialFormData }); setStep(0) }} />
        )}
      </div>
    </div>
  )
}
