// Price Hunter Popup Script

const API_URL = 'http://localhost:3000';

async function init() {
    // Check API status
    try {
        const response = await fetch(`${API_URL}/api/stats`);
        if (response.ok) {
            const stats = await response.json();
            
            document.getElementById('status').classList.remove('offline');
            document.getElementById('status-text').textContent = 'Connected to Price Hunter';
            document.getElementById('products-count').textContent = 
                stats.total_products?.toLocaleString() || '0';
            document.getElementById('stores-count').textContent = 
                stats.total_stores?.toLocaleString() || '0';
        } else {
            throw new Error('API not responding');
        }
    } catch (err) {
        document.getElementById('status').classList.add('offline');
        document.getElementById('status-text').textContent = 'Server offline';
        document.getElementById('products-count').textContent = '-';
        document.getElementById('stores-count').textContent = '-';
    }
    
    // Scan button handler
    document.getElementById('scan-btn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to rescan
        chrome.tabs.sendMessage(tab.id, { action: 'rescan' }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Could not send message to content script');
            }
        });
        
        window.close();
    });
    
    // Settings button handler
    document.getElementById('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}

document.addEventListener('DOMContentLoaded', init);
