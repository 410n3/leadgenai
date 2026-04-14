import { normalizeCompanyName, resolveLinkedInCompanyName } from './nlpService.js'
import { searchLinkedInProfiles } from './linkedinGoogleSearchService.js'
import { searchLinkedInProfilesApify } from './apifyService.js'

// Resolve a list of company names to their LinkedIn brand names via AI
async function resolveCompanyNames(names, emit) {
  const resolved = []
  for (const name of names) {
    try {
      const linkedinName = await resolveLinkedInCompanyName(name)
      if (linkedinName !== name) emit(`Resolved: "${name}" → "${linkedinName}"`)
      resolved.push(linkedinName)
    } catch (_) {
      resolved.push(name)
    }
  }
  return resolved
}

function normalizeProfile(p) {
  return {
    name:        p.name || '',
    title:       p.title || '',
    linkedinUrl: p.linkedinUrl || '',
    email:       p.email || '',
    location:    p.location || '',
    company:     p.company || '',
    verified:    true
  }
}

// Map profiles back to leads using company name matching
function mapProfilesToLeads(leads, companyProfileMap, resolvedNamesMap = {}) {
  return leads.map(lead => {
    const formalName = lead.name || ''
    const linkedinName = resolvedNamesMap[formalName] || formalName

    let profiles = companyProfileMap[linkedinName] || companyProfileMap[formalName] || []

    if (!profiles.length) {
      const normLinkedin = normalizeCompanyName(linkedinName).toLowerCase()
      const normFormal = normalizeCompanyName(formalName).toLowerCase()
      for (const [key, profs] of Object.entries(companyProfileMap)) {
        const normKey = normalizeCompanyName(key).toLowerCase()
        if (normKey.length > 2 && (normKey.includes(normLinkedin) || normLinkedin.includes(normKey) ||
            normKey.includes(normFormal) || normFormal.includes(normKey))) {
          profiles = profs
          break
        }
      }
    }

    const contacts = profiles.map(normalizeProfile)
    return { ...lead, apifyContacts: contacts, googleContacts: contacts }
  })
}

export async function runLinkedInContactScraper(inputs, onProgress) {
  const { leads, jobTitles, location, useApify = false, maxItemsPerCompany = 3 } = inputs
  if (!leads || leads.length === 0) return []

  const emit = (msg) => onProgress({ status: msg, message: msg })
  const jobTitleList = jobTitles ? jobTitles.split(',').map(t => t.trim()).filter(Boolean) : []
  const locationStr = location ? location.split(',')[0].trim() : ''
  const rawCompanyNames = leads.map(l => l.name).filter(Boolean)

  emit('Resolving company names via AI...')
  const resolvedNames = await resolveCompanyNames(rawCompanyNames, emit)
  const resolvedNamesMap = {}
  rawCompanyNames.forEach((n, i) => { resolvedNamesMap[n] = resolvedNames[i] })

  emit(`Starting ${useApify ? 'Apify' : 'Google LinkedIn X-Ray'} search...`)
  const searchInputs = resolvedNames.map(company => ({
    company,
    jobTitles: jobTitleList,
    location: locationStr,
    maxResults: maxItemsPerCompany
  }))

  const results = useApify 
    ? await searchLinkedInProfilesApify(searchInputs, emit)
    : await searchLinkedInProfiles(searchInputs, emit)

  const companyProfileMap = {}
  for (const { company, profiles } of results) {
    companyProfileMap[company] = profiles
  }

  const mapped = mapProfilesToLeads(leads, companyProfileMap, resolvedNamesMap)
  emit(`Done. Found contacts for ${mapped.filter(l => l.googleContacts?.length > 0).length} of ${leads.length} companies.`)
  return mapped
}

export async function runLinkedInProfileSearchPerCompany(inputs, onProgress) {
  const { leads, jobTitles, location, maxItemsPerCompany = 5, useApify = false } = inputs
  if (!leads || leads.length === 0) return []

  const emit = (msg) => onProgress({ status: msg, message: msg })
  const jobTitleList = jobTitles ? jobTitles.split(',').map(t => t.trim()).filter(Boolean) : []
  const locationStr = location ? location.split(',')[0].trim() : ''

  const resultLeads = [...leads]

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    if (!lead.name) continue

    emit(`[${i + 1}/${leads.length}] Resolving: ${lead.name}`)
    const company = await resolveLinkedInCompanyName(lead.name).catch(() => lead.name)
    if (company !== lead.name) emit(`  → LinkedIn name: "${company}"`)

    try {
      const searchInputs = [{
        company,
        jobTitles: jobTitleList,
        location: locationStr,
        maxResults: maxItemsPerCompany
      }]

      const results = useApify
        ? await searchLinkedInProfilesApify(searchInputs, emit)
        : await searchLinkedInProfiles(searchInputs, emit)

      const profiles = (results[0]?.profiles || []).map(normalizeProfile)
      emit(`Found ${profiles.length} profiles for ${company}`)
      resultLeads[i] = { ...lead, apifyContacts: profiles, googleContacts: profiles }
    } catch (e) {
      emit(`Error for ${company}: ${e.message}`)
      resultLeads[i] = { ...lead, apifyContacts: [], googleContacts: [] }
    }
  }

  emit(`Done. Processed ${leads.length} companies.`)
  return resultLeads
}
