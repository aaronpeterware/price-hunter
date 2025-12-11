import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

// Scrape a single Shopify store's products
export async function scrapeShopifyStore(domain) {
    const products = [];
    let page = 1;
    let hasMore = true;
    
    console.log(`🔍 Scraping ${domain}...`);
    
    while (hasMore && page <= 10) { // Max 10 pages (2500 products per store)
        try {
            const url = `https://${domain}/products.json?limit=250&page=${page}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceHunter/1.0)',
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`   ❌ ${domain} - Not a Shopify store or products.json disabled`);
                } else if (response.status === 429) {
                    console.log(`   ⏳ ${domain} - Rate limited, waiting...`);
                    await sleep(5000);
                    continue;
                } else {
                    console.log(`   ❌ ${domain} - HTTP ${response.status}`);
                }
                break;
            }
            
            const data = await response.json();
            
            if (!data.products || data.products.length === 0) {
                hasMore = false;
                break;
            }
            
            for (const product of data.products) {
                // Get the first available variant
                const variant = product.variants?.[0];
                if (!variant) continue;
                
                // Skip out of stock
                if (variant.available === false) continue;
                
                products.push({
                    title: product.title,
                    price: parseFloat(variant.price),
                    currency: 'USD', // Shopify stores price in shop currency
                    store_domain: domain,
                    url: `https://${domain}/products/${product.handle}`,
                    image_url: product.images?.[0]?.src || null,
                    vendor: product.vendor || null,
                    category: product.product_type || null,
                    source: 'shopify_scrape'
                });
            }
            
            console.log(`   📦 Page ${page}: ${data.products.length} products`);
            
            if (data.products.length < 250) {
                hasMore = false;
            } else {
                page++;
                await sleep(500); // Be nice to the server
            }
            
        } catch (err) {
            console.error(`   ❌ Error scraping ${domain}:`, err.message);
            break;
        }
    }
    
    console.log(`   ✅ ${domain}: ${products.length} total products`);
    return products;
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sample list of known Shopify stores (you'd expand this)
const SEED_STORES = [
    // Beauty & Skincare
    'colourpop.com',
    'kyliecosmetics.com',
    'glossier.com',
    'theordinary.com',
    'fentybeauty.com',
    'milkmakeup.com',
    'tartecosmetics.com',
    'morphe.com',
    
    // Fashion
    'fashionnova.com',
    'gymshark.com',
    'allbirds.com',
    'brooklinen.com',
    'chubbiesshorts.com',
    'puravidabracelets.com',
    'mvmtwatches.com',
    
    // Health & Supplements
    'athleticgreens.com',
    'ritualsupplements.com',
    
    // Home & Lifestyle
    'bombas.com',
    'away.com',
    'casper.com',
    
    // Food & Beverage
    'drinkmudwtr.com',
    'liquidiv.com',
    
    // Tech Accessories
    'casetify.com',
    'nomadgoods.com',
    'peakdesign.com',
];

// Main scraping function
async function main() {
    // Create data directory
    const { mkdirSync } = await import('fs');
    try {
        mkdirSync('./data', { recursive: true });
    } catch (e) {}
    
    // Initialize database
    const db = createDB();
    await initDB(db);
    
    let totalProducts = 0;
    let successfulStores = 0;
    
    console.log('\n🚀 Starting Shopify store scrape...\n');
    console.log(`📋 ${SEED_STORES.length} stores to scrape\n`);
    
    for (const domain of SEED_STORES) {
        try {
            // Register the store
            await registerStore(db, {
                domain,
                platform: 'shopify'
            });
            
            // Scrape products
            const products = await scrapeShopifyStore(domain);
            
            // Insert into database
            for (const product of products) {
                await upsertProduct(db, product);
            }
            
            // Update store stats
            await updateStoreStats(db, domain, products.length);
            
            if (products.length > 0) {
                successfulStores++;
                totalProducts += products.length;
            }
            
            // Rate limiting between stores
            await sleep(1000);
            
        } catch (err) {
            console.error(`Failed to process ${domain}:`, err.message);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 SCRAPE COMPLETE');
    console.log('='.repeat(50));
    console.log(`✅ Stores scraped: ${successfulStores}/${SEED_STORES.length}`);
    console.log(`📦 Total products: ${totalProducts.toLocaleString()}`);
    console.log('='.repeat(50) + '\n');
    
    // Show sample data
    const sample = await db.execute('SELECT title, price, store_domain FROM products ORDER BY RANDOM() LIMIT 5');
    console.log('📝 Sample products:');
    for (const row of sample.rows) {
        console.log(`   $${row.price} - ${row.title} (${row.store_domain})`);
    }
}

main().catch(console.error);
