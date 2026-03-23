import { chromium } from 'playwright';

async function test() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://console.apify.com/sign-in');
    console.log("Please log in manually inside the browser window...");

    // wait until url is no longer sign-in
    await page.waitForTimeout(15000);

    const token = await page.evaluate(() => {
        let t = null;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            const val = localStorage.getItem(k);
            if (val && val.includes('token')) {
                console.log(k, val);
            }
        }
        // often there's a specific key for auth
        return localStorage.getItem('auth_token') || localStorage.getItem('login-token');
    });

    console.log("Found token?:", token ? "Yes" : "No");

    await browser.close();
}

test().catch(console.error);
