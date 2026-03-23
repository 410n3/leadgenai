import { pipeline, env } from '@xenova/transformers';

// Disable remote models caching in a random place, use current dir or system cache
env.allowLocalModels = false;
env.useBrowserCache = false;

async function testQA() {
    console.log('Loading QA model...');
    // distilbert-base-cased-distilled-squad is ~240MB, quantized it's ~60MB RAM
    const qa = await pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad', {
        quantized: true,
    });

    const texts = [
        "Google's AI overview says that the total revenue for the third quarter of 2023 was reported to be around ₹5,000 crore, although profits were down compared to the last fiscal year.",
        "Company X has a turnover of 54 Lakhs according to the latest filing.",
        "In 2022, operating revenue is INR 50.5 cr with a net profit margin of 12%.",
        "They posted an annual revenue over 100 Mn dollars in the US market."
    ];

    console.log('Model loaded. Testing extracted snippets...\n');

    for (const context of texts) {
        const start = Date.now();
        const result = await qa('What is the revenue or turnover?', context);
        const ms = Date.now() - start;

        console.log(`Context: "${context}"`);
        console.log(`Answer: "${result.answer}" (score: ${Math.round(result.score * 100)}%) - took ${ms}ms`);
        console.log("----");
    }
}

testQA().catch(console.error);
