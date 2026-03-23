import { saveLeads } from './src/main/services/sheetsService.js'

async function test() {
    console.log("Testing Google Sheets Export...")
    const mockLead = {
        name: 'Nvidia Graphics India Pvt Ltd test',
        fullAddress: '6, Chinappa Layout, Bengaluru',
        category: 'Tech Company',
        googleContacts: [
            { name: "John Doe", linkedinUrl: "https://linkedin.com/in/johndoe" },
            { name: "Jane Smith", linkedinUrl: "https://linkedin.com/in/janesmith" }
        ]
    }

    try {
        await saveLeads([mockLead], "test-session-1234")
        console.log("Success! Data written to Google Sheet.")
    } catch (e) {
        console.error("Error writing to sheet:", e)
    }
}

test()
