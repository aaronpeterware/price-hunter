// Price Hunter Background Service Worker

const API_URL = 'http://localhost:3000';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'findAlternatives') {
        findAlternatives(message.product)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }
    
    if (message.action === 'reportProduct') {
        reportProduct(message.product)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

// Find alternatives via API
async function findAlternatives(product) {
    const response = await fetch(`${API_URL}/api/find-alternatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    });
    
    if (!response.ok) throw new Error('API error');
    return await response.json();
}

// Report product sighting
async function reportProduct(product) {
    const response = await fetch(`${API_URL}/api/report-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: [product] })
    });
    
    if (!response.ok) throw new Error('API error');
    return await response.json();
}

// Set up badge on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Price Hunter installed');
});
