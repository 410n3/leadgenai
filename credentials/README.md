# Google Service Account Credentials

Place your `credentials.json` (Google Service Account key) here.

Or you can set it up through the app's Setup Screen which will copy the file automatically.

## Steps to get credentials:

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Google Sheets API" (APIs & Services → Library)
4. Go to "APIs & Services" → "Credentials"
5. Click "Create Credentials" → "Service account"
6. Fill in name, click "Create and Continue"
7. Click "Done"
8. Click on the service account you created
9. Go to "Keys" tab → "Add Key" → "Create new key" → JSON
10. Download the JSON file and place it here as `credentials.json`

## Share the spreadsheet:

Once you have the service account, copy the `client_email` from credentials.json and share your Google Sheet with that email address (give Editor access).

Your spreadsheet: https://docs.google.com/spreadsheets/d/1mNixw9OXD5rsnKEc3v7FrL_T7D2L0-Gk_D_IdVN7Llw/edit
