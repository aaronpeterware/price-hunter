import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

// Realistic mock product data - same product across multiple stores
const MOCK_PRODUCTS = [
    // CeraVe products - popular skincare
    {
        product: 'CeraVe Moisturizing Cream 16oz',
        stores: [
            { domain: 'target.com', price: 18.99 },
            { domain: 'walmart.com', price: 17.47 },
            { domain: 'amazon.com', price: 16.99 },
            { domain: 'cvs.com', price: 19.99 },
            { domain: 'walgreens.com', price: 18.49 },
            { domain: 'ulta.com', price: 18.99 },
        ],
        category: 'skincare',
        vendor: 'CeraVe'
    },
    {
        product: 'CeraVe Hydrating Facial Cleanser 12oz',
        stores: [
            { domain: 'target.com', price: 15.99 },
            { domain: 'walmart.com', price: 14.97 },
            { domain: 'amazon.com', price: 14.64 },
            { domain: 'cvs.com', price: 16.99 },
            { domain: 'ulta.com', price: 15.99 },
        ],
        category: 'skincare',
        vendor: 'CeraVe'
    },
    {
        product: 'CeraVe AM Facial Moisturizing Lotion SPF 30 3oz',
        stores: [
            { domain: 'target.com', price: 17.99 },
            { domain: 'walmart.com', price: 15.97 },
            { domain: 'amazon.com', price: 14.99 },
            { domain: 'walgreens.com', price: 18.99 },
        ],
        category: 'skincare',
        vendor: 'CeraVe'
    },
    
    // The Ordinary products
    {
        product: 'The Ordinary Niacinamide 10% + Zinc 1% 30ml',
        stores: [
            { domain: 'sephora.com', price: 11.90 },
            { domain: 'ulta.com', price: 11.90 },
            { domain: 'theordinary.com', price: 11.90 },
            { domain: 'amazon.com', price: 13.99 },
            { domain: 'beautybay.com', price: 10.50 },
        ],
        category: 'skincare',
        vendor: 'The Ordinary'
    },
    {
        product: 'The Ordinary Hyaluronic Acid 2% + B5 30ml',
        stores: [
            { domain: 'sephora.com', price: 11.90 },
            { domain: 'ulta.com', price: 11.90 },
            { domain: 'amazon.com', price: 14.99 },
            { domain: 'beautybay.com', price: 9.90 },
        ],
        category: 'skincare',
        vendor: 'The Ordinary'
    },
    
    // Tech accessories
    {
        product: 'Apple AirPods Pro 2nd Generation',
        stores: [
            { domain: 'apple.com', price: 249.00 },
            { domain: 'amazon.com', price: 189.99 },
            { domain: 'bestbuy.com', price: 199.99 },
            { domain: 'walmart.com', price: 199.00 },
            { domain: 'target.com', price: 199.99 },
            { domain: 'costco.com', price: 179.99 },
        ],
        category: 'electronics',
        vendor: 'Apple'
    },
    {
        product: 'Samsung Galaxy Buds 2 Pro',
        stores: [
            { domain: 'samsung.com', price: 229.99 },
            { domain: 'amazon.com', price: 159.99 },
            { domain: 'bestbuy.com', price: 169.99 },
            { domain: 'walmart.com', price: 164.99 },
        ],
        category: 'electronics',
        vendor: 'Samsung'
    },
    
    // Phone cases
    {
        product: 'OtterBox Defender Series Case iPhone 15 Pro',
        stores: [
            { domain: 'otterbox.com', price: 64.95 },
            { domain: 'amazon.com', price: 44.95 },
            { domain: 'bestbuy.com', price: 54.99 },
            { domain: 'target.com', price: 54.99 },
            { domain: 'walmart.com', price: 49.88 },
        ],
        category: 'phone accessories',
        vendor: 'OtterBox'
    },
    
    // Supplements
    {
        product: 'Athletic Greens AG1 Powder 30 Servings',
        stores: [
            { domain: 'athleticgreens.com', price: 99.00 },
            { domain: 'amazon.com', price: 109.00 },
        ],
        category: 'supplements',
        vendor: 'Athletic Greens'
    },
    {
        product: 'Liquid IV Hydration Multiplier 16 Pack Lemon Lime',
        stores: [
            { domain: 'liquid-iv.com', price: 24.99 },
            { domain: 'amazon.com', price: 23.98 },
            { domain: 'costco.com', price: 29.99 },
            { domain: 'target.com', price: 24.99 },
            { domain: 'walmart.com', price: 22.98 },
        ],
        category: 'supplements',
        vendor: 'Liquid IV'
    },
    
    // Home goods
    {
        product: 'Brooklinen Luxe Core Sheet Set Queen',
        stores: [
            { domain: 'brooklinen.com', price: 179.00 },
            { domain: 'amazon.com', price: 195.00 },
            { domain: 'nordstrom.com', price: 179.00 },
        ],
        category: 'home',
        vendor: 'Brooklinen'
    },
    {
        product: 'Casper Original Pillow Standard',
        stores: [
            { domain: 'casper.com', price: 65.00 },
            { domain: 'amazon.com', price: 55.00 },
            { domain: 'target.com', price: 59.00 },
        ],
        category: 'home',
        vendor: 'Casper'
    },
    
    // Fashion
    {
        product: 'Allbirds Wool Runners Mens Size 10',
        stores: [
            { domain: 'allbirds.com', price: 110.00 },
            { domain: 'amazon.com', price: 119.00 },
            { domain: 'rei.com', price: 110.00 },
        ],
        category: 'footwear',
        vendor: 'Allbirds'
    },
    {
        product: 'Bombas Ankle Socks 4 Pack',
        stores: [
            { domain: 'bombas.com', price: 58.00 },
            { domain: 'amazon.com', price: 64.00 },
            { domain: 'nordstrom.com', price: 58.00 },
        ],
        category: 'apparel',
        vendor: 'Bombas'
    },
    
    // More skincare
    {
        product: 'La Roche-Posay Toleriane Double Repair Face Moisturizer 2.5oz',
        stores: [
            { domain: 'laroche-posay.us', price: 22.99 },
            { domain: 'amazon.com', price: 18.99 },
            { domain: 'ulta.com', price: 22.99 },
            { domain: 'target.com', price: 21.99 },
            { domain: 'walgreens.com', price: 22.99 },
        ],
        category: 'skincare',
        vendor: 'La Roche-Posay'
    },
    {
        product: 'Neutrogena Hydro Boost Water Gel 1.7oz',
        stores: [
            { domain: 'neutrogena.com', price: 19.99 },
            { domain: 'amazon.com', price: 14.97 },
            { domain: 'target.com', price: 16.99 },
            { domain: 'walmart.com', price: 15.97 },
            { domain: 'cvs.com', price: 18.99 },
        ],
        category: 'skincare',
        vendor: 'Neutrogena'
    },
    
    // Protein powder
    {
        product: 'Optimum Nutrition Gold Standard Whey Protein 5lb Chocolate',
        stores: [
            { domain: 'optimumnutrition.com', price: 89.99 },
            { domain: 'amazon.com', price: 62.99 },
            { domain: 'bodybuilding.com', price: 67.99 },
            { domain: 'walmart.com', price: 69.98 },
            { domain: 'gnc.com', price: 84.99 },
            { domain: 'costco.com', price: 57.99 },
        ],
        category: 'supplements',
        vendor: 'Optimum Nutrition'
    },
    
    // Coffee
    {
        product: 'Nespresso Vertuo Original Capsules 30ct Variety Pack',
        stores: [
            { domain: 'nespresso.com', price: 42.00 },
            { domain: 'amazon.com', price: 39.00 },
            { domain: 'target.com', price: 42.00 },
            { domain: 'bedbathandbeyond.com', price: 42.00 },
        ],
        category: 'food & beverage',
        vendor: 'Nespresso'
    },
];

async function main() {
    // Create data directory
    const { mkdirSync } = await import('fs');
    try {
        mkdirSync('./data', { recursive: true });
    } catch (e) {}
    
    // Initialize database
    const db = createDB();
    await initDB(db);
    
    console.log('\n🌱 Seeding database with realistic mock data...\n');
    
    let totalProducts = 0;
    const stores = new Set();
    
    for (const item of MOCK_PRODUCTS) {
        for (const store of item.stores) {
            const product = {
                title: item.product,
                price: store.price,
                store_domain: store.domain,
                url: `https://${store.domain}/products/${item.product.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                image_url: `https://placekitten.com/400/400`, // placeholder
                vendor: item.vendor,
                category: item.category,
                source: 'mock_seed'
            };
            
            await upsertProduct(db, product);
            stores.add(store.domain);
            totalProducts++;
        }
        console.log(`   ✅ ${item.product} - ${item.stores.length} stores`);
    }
    
    // Register stores
    for (const domain of stores) {
        await registerStore(db, { domain, platform: 'various' });
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🌱 SEED COMPLETE');
    console.log('='.repeat(50));
    console.log(`📦 Total products: ${totalProducts}`);
    console.log(`🏪 Total stores: ${stores.size}`);
    console.log('='.repeat(50));
    
    // Test a search
    console.log('\n🔍 Testing search for "CeraVe Moisturizing Cream"...\n');
    
    const { findAlternatives } = await import('../src/db.js');
    const testProduct = {
        title: 'CeraVe Moisturizing Cream 16oz',
        store_domain: 'target.com',
        price: 18.99
    };
    
    const { results, match_type } = await findAlternatives(db, testProduct);
    
    console.log(`Match type: ${match_type}`);
    console.log(`Found ${results.length} alternatives:\n`);
    
    for (const alt of results) {
        const savings = (testProduct.price - alt.price).toFixed(2);
        const emoji = alt.price < testProduct.price ? '💰' : '  ';
        console.log(`${emoji} $${alt.price.toFixed(2)} at ${alt.store_domain} (save $${savings})`);
    }
}

main().catch(console.error);
