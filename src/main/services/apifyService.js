/**
 * Service to interact with Apify Actors.
 * Specifically for code_crafter/leads-finder.
 */

export async function searchLinkedInProfilesApify(searchInputs, onProgress) {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is not set. Please add it in Settings.');
  }

  const allResults = [];

  // This actor supports batching, so we can run one run for multiple companies if needed,
  // but to keep it consistent with the existing per-company flow and progress reporting,
  // we'll run it for each company.
  
  for (let i = 0; i < searchInputs.length; i++) {
    const { company, jobTitles, location, maxResults = 5 } = searchInputs[i];
    
    onProgress(`[${i + 1}/${searchInputs.length}] Leads Finder: ${company}`);

    try {
      // Input for code_crafter/leads-finder
      const input = {
        "company_names": [company],
        "job_titles": jobTitles,
        "location": location ? [location] : [],
        "limit": maxResults,
        "email_status": ["validated"]
      };

      // Using the run-sync-get-dataset-items endpoint for immediate results
      const response = await fetch(`https://api.apify.com/v2/acts/code_crafter~leads-finder/run-sync-get-dataset-items?token=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Apify API error: ${response.status} - ${errText}`);
      }

      const items = await response.json();
      
      const parsed = items.map(item => ({
        name: `${item.first_name || ''} ${item.last_name || ''}`.trim(),
        title: item.title || '',
        linkedinUrl: item.linkedin_url || '',
        location: `${item.city || ''}, ${item.state || ''}, ${item.country || ''}`.replace(/^, |, $/g, '').replace(/, , /g, ', '),
        company: item.company_name || company,
        email: item.work_email || '',
        verified: true
      })).filter(p => p.name && (p.linkedinUrl || p.email));

      onProgress(`Leads Finder found ${parsed.length} profiles for ${company}`);
      allResults.push({ company, profiles: parsed });

    } catch (err) {
      onProgress(`Leads Finder error for ${company}: ${err.message}`);
      allResults.push({ company, profiles: [] });
    }

    // Small delay between companies
    if (i < searchInputs.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allResults;
}
