// Price Hunter Content Script
// Runs on all pages, detects product pages, extracts info

const API_URL = 'http://localhost:3000'; // Change to production URL

// Store detection patterns
const PRODUCT_PAGE_SIGNALS = {
    // URL patterns
    urlPatterns: [
        /\/products?\//i,
        /\/item\//i,
        /\/p\//i,
        /\/dp\//i,  // Amazon
        /\/ip\//i,  // Walmart
        /\/(buy|shop).*\//i,
    ],
    
    // Meta tags that indicate product pages
    metaTags: [
        'og:type',           // Should be "product"
        'product:price:amount',
        'product:price:currency',
    ],
    
    // Schema.org structured data
    schemaTypes: ['Product', 'IndividualProduct'],
};

// Price extraction patterns
const PRICE_PATTERNS = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,  // $XX.XX
    /USD\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|dollars?)/i,
];

// Common selectors for product info
const SELECTORS = {
    title: [
        'h1[data-test="product-title"]',
        'h1.product-title',
        'h1.product-name',
        'h1[itemprop="name"]',
        '.product-title h1',
        '#productTitle',  // Amazon
        'h1.prod-ProductTitle',  // Walmart
        '[data-testid="product-title"]',
        'h1',  // Fallback
    ],
    price: [
        '[data-test="product-price"]',
        '.product-price',
        '.price-current',
        '[itemprop="price"]',
        '.price .money',
        '#priceblock_ourprice',  // Amazon
        '#priceblock_dealprice',
        '.price-characteristic',  // Walmart
        '[data-testid="product-price"]',
        '.sale-price',
        '.current-price',
    ],
    image: [
        'meta[property="og:image"]',
        '[data-test="product-image"] img',
        '.product-image img',
        '#landingImage',  // Amazon
        '[itemprop="image"]',
    ],
};

class ProductDetector {
    constructor() {
        this.product = null;
        this.overlayShown = false;
    }
    
    // Check if current page is a product page
    isProductPage() {
        const url = window.location.href;
        
        // Check URL patterns
        for (const pattern of PRODUCT_PAGE_SIGNALS.urlPatterns) {
            if (pattern.test(url)) return true;
        }
        
        // Check meta tags
        const ogType = document.querySelector('meta[property="og:type"]');
        if (ogType && ogType.content === 'product') return true;
        
        // Check for structured data
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@type'] === 'Product' || 
                    (Array.isArray(data['@graph']) && 
                     data['@graph'].some(item => item['@type'] === 'Product'))) {
                    return true;
                }
            } catch (e) {}
        }
        
        // Check for price + title combination
        const hasPrice = this.extractPrice() !== null;
        const hasTitle = this.extractTitle() !== null;
        
        return hasPrice && hasTitle;
    }
    
    // Extract product title
    extractTitle() {
        // Try structured data first
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@type'] === 'Product' && data.name) {
                    return data.name;
                }
                if (Array.isArray(data['@graph'])) {
                    const product = data['@graph'].find(item => item['@type'] === 'Product');
                    if (product && product.name) return product.name;
                }
            } catch (e) {}
        }
        
        // Try meta tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) return ogTitle.content;
        
        // Try selectors
        for (const selector of SELECTORS.title) {
            const el = document.querySelector(selector);
            if (el && el.textContent.trim()) {
                const title = el.textContent.trim();
                // Skip if it's just the site name
                if (title.length > 5 && title.length < 500) {
                    return title;
                }
            }
        }
        
        return null;
    }
    
    // Extract product price
    extractPrice() {
        // Try structured data first
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent);
                let price = null;
                
                if (data['@type'] === 'Product') {
                    price = data.offers?.price || data.offers?.[0]?.price;
                }
                if (Array.isArray(data['@graph'])) {
                    const product = data['@graph'].find(item => item['@type'] === 'Product');
                    price = product?.offers?.price || product?.offers?.[0]?.price;
                }
                
                if (price) return parseFloat(price);
            } catch (e) {}
        }
        
        // Try meta tags
        const priceMeta = document.querySelector('meta[property="product:price:amount"]');
        if (priceMeta && priceMeta.content) {
            return parseFloat(priceMeta.content);
        }
        
        // Try selectors
        for (const selector of SELECTORS.price) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.textContent || el.content;
                for (const pattern of PRICE_PATTERNS) {
                    const match = text.match(pattern);
                    if (match) {
                        return parseFloat(match[1].replace(/,/g, ''));
                    }
                }
            }
        }
        
        return null;
    }
    
    // Extract product image
    extractImage() {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) return ogImage.content;
        
        for (const selector of SELECTORS.image) {
            const el = document.querySelector(selector);
            if (el) {
                return el.src || el.content;
            }
        }
        
        return null;
    }
    
    // Get store domain
    getStoreDomain() {
        return window.location.hostname.replace(/^www\./, '');
    }
    
    // Extract all product info
    extractProduct() {
        const title = this.extractTitle();
        const price = this.extractPrice();
        const image = this.extractImage();
        const store = this.getStoreDomain();
        const url = window.location.href;
        
        if (!title) return null;
        
        return {
            title,
            price,
            image_url: image,
            store_domain: store,
            url
        };
    }
    
    // Send to API and get alternatives
    async findAlternatives(product) {
        try {
            const response = await fetch(`${API_URL}/api/find-alternatives`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product)
            });
            
            if (!response.ok) throw new Error('API error');
            
            return await response.json();
        } catch (err) {
            console.error('Price Hunter API error:', err);
            return null;
        }
    }
    
    // Show overlay with alternatives
    showOverlay(product, results) {
        if (this.overlayShown) return;
        
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.id = 'price-hunter-overlay';
        overlay.innerHTML = this.renderOverlay(product, results);
        document.body.appendChild(overlay);
        
        // Add close handler
        overlay.querySelector('.ph-close').addEventListener('click', () => {
            overlay.remove();
            this.overlayShown = false;
        });
        
        // Add click handlers for alternatives
        overlay.querySelectorAll('.ph-alt-item').forEach(item => {
            item.addEventListener('click', () => {
                window.open(item.dataset.url, '_blank');
            });
        });
        
        this.overlayShown = true;
    }
    
    // Render overlay HTML
    renderOverlay(product, results) {
        const { alternatives, cheapest } = results;
        
        if (!alternatives || alternatives.length === 0) {
            return `
                <div class="ph-container">
                    <div class="ph-header">
                        <span class="ph-logo">🔍 Price Hunter</span>
                        <button class="ph-close">×</button>
                    </div>
                    <div class="ph-body ph-no-results">
                        <p>No alternatives found yet.</p>
                        <p class="ph-small">We're tracking this product for future searches.</p>
                    </div>
                </div>
            `;
        }
        
        const savings = product.price && cheapest ? 
            (product.price - cheapest.price).toFixed(2) : '0.00';
        
        const savingsPercent = product.price && cheapest ? 
            Math.round((savings / product.price) * 100) : 0;
        
        let alternativesHtml = alternatives
            .slice(0, 5)
            .map(alt => {
                const isCheaper = product.price && alt.price < product.price;
                const altSavings = product.price ? 
                    (product.price - alt.price).toFixed(2) : null;
                
                return `
                    <div class="ph-alt-item ${isCheaper ? 'ph-cheaper' : ''}" 
                         data-url="${alt.url}">
                        <div class="ph-alt-store">${alt.store}</div>
                        <div class="ph-alt-price">$${alt.price.toFixed(2)}</div>
                        ${isCheaper ? `<div class="ph-alt-savings">Save $${altSavings}</div>` : ''}
                    </div>
                `;
            })
            .join('');
        
        return `
            <div class="ph-container">
                <div class="ph-header">
                    <span class="ph-logo">🔍 Price Hunter</span>
                    <button class="ph-close">×</button>
                </div>
                <div class="ph-body">
                    ${parseFloat(savings) > 0 ? `
                        <div class="ph-savings-banner">
                            💰 Save up to $${savings} (${savingsPercent}%)
                        </div>
                    ` : ''}
                    <div class="ph-product-title">${product.title.substring(0, 60)}...</div>
                    <div class="ph-current-price">
                        Current: <strong>$${product.price?.toFixed(2) || 'N/A'}</strong> 
                        at ${product.store_domain}
                    </div>
                    <div class="ph-alternatives">
                        <div class="ph-section-title">Also available at:</div>
                        ${alternativesHtml}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Main run function
    async run() {
        // Wait a bit for page to fully load
        await new Promise(r => setTimeout(r, 1000));
        
        if (!this.isProductPage()) {
            console.log('Price Hunter: Not a product page');
            return;
        }
        
        const product = this.extractProduct();
        if (!product) {
            console.log('Price Hunter: Could not extract product info');
            return;
        }
        
        console.log('Price Hunter: Found product', product);
        
        const results = await this.findAlternatives(product);
        if (results && results.alternatives_count > 0) {
            this.showOverlay(product, results);
        }
    }
}

// Run detector
const detector = new ProductDetector();
detector.run();

// Also run on dynamic page changes (SPAs)
let lastUrl = window.location.href;
new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => detector.run(), 1500);
    }
}).observe(document, { subtree: true, childList: true });
