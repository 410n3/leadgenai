import 'dotenv/config'
import fs from 'fs'
import { runGoogleContactsScraper } from './src/main/services/contactScraperService.js'

async function test() {
    process.env.USE_LOCAL_ML = 'true'
    process.env.LOCAL_ML_URL = 'http://localhost:11434/v1'
    process.env.LOCAL_ML_MODEL = 'qwen2.5:0.5b'

    console.log("Testing Nvidia Bengalore Contact AI extraction...")

    const mockLead = {
        name: 'Nvidia Graphics India Pvt Ltd',
        fullAddress: '6, Chinappa Layout, Laxmi Sagar Layout, Mahadevapura, Bengaluru, Karnataka 560048'
    }

    const inputs = {
        leads: [mockLead],
        jobTitles: 'ehs head, ehs officer, security officer',
        location: 'Bengaluru' // This param is now ignored internally by the query
    }

    const results = await runGoogleContactsScraper(inputs, (msg) => {
        console.log(`[Progress] ${msg.status || msg}`)
    })

    console.log("\n\n------- FINAL RETURNED ARRAY -------")
    console.log(JSON.stringify(results, null, 2))
}

test()
