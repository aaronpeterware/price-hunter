import { createDB, initDB, upsertProduct, registerStore } from '../src/db.js';
import { writeFileSync } from 'fs';

const JINA_API_KEY = 'jina_3d4f6fc18773417b85622e6c5a62b40fIUT3oHdGfQUu8TZsY476hDMd4Lg-';

const PAGES = [
    { url: 'https://www.amazon.com/gp/bestsellers/beauty/11060451', store: 'amazon.com', cat: 'skincare' },
    { url: 'https://www.amazon.com/gp/bestsellers/beauty/11062741', store: 'amazon.com', cat: 'moisturizers' },
    { url: 'https://www.amazon.com/gp/bestsellers/electronics/172541', store: 'amazon.com', cat: 'headphones' },
    { url: 'https://www.amazon.com/gp/bestsellers/hpc/3760941', store: 'amazon.com', cat: 'vitamins' },
    { url: 'https://www.costco.com/skin-care.html', store: 'costco.com', cat: 'skincare' },
    { url: 'https://www.costco.com/vitamins.html', store: 'costco.com', cat: 'vitamins' },
    { url: 'https://www.walgreens.com/store/c/skin-care/ID=359434-tier2general', store: 'walgreens.com', cat: 'skincare' },
    { url: 'https://www.target.com/c/facial-moisturizers-skin-care-beauty/-/N-5xu2a', store: 'target.com', cat: 'moisturizers' },
    { url: 'https://www.target.com/c/serums-treatments-skin-care-beauty/-/N-4y2xl', store: 'target.com', cat: 'serums' },
];

async function fetchJina(url) {
    try {
        console.log(`   Fetching: ${url.substring(0, 60)}...`);
        const res = await fetch('https://r.jina.ai/' + url, {
            headers: { 
                'Authorization': 'Bearer ' + JINA_API_KEY, 
                'X-Return-Format': 'markdown',
                'X-With-Links-Summary': 'true'
            },
            signal: AbortSignal.timeout(45000)
        });
        if (!res.ok) {
            console.log(`   HTTP ${res.status}`);
            return null;
        }
        return await res.text();
    } catch (e) { 
        console.log(`   Error: ${e.message}`);
        return null; 
    }
}

function extract(content, store, cat) {
    const products = [], seen = new Set();
    
    // Multiple patterns to catch different formats
    const patterns = [
        // $XX.XX ... Product Name (caps start)
        /\$(\d{1,3}(?:\.\d{2})?)\s+([A-Z][A-Za-z0-9\s\-\']+(?:[A-Za-z]+))/g,
        // Product Name ... $XX.XX
        /([A-Z][A-Za-z0-9\s\-\']{10,60})\s+\$(\d{1,3}(?:\.\d{2})?)/g,
        // **Product** ... $XX
        /\*\*([^*]{5,80})\*\*[^$]{0,50}\$(\d{1,3}(?:\.\d{2})?)/g,
        // [Product](link) ... $XX
        /\[([^\]]{5,80})\]\([^)]+\)[^$]{0,30}\$(\d{1,3}(?:\.\d{2})?)/g,
        // #X. Product ... $XX (numbered lists)
        /#?\d+\.\s*([A-Za-z][^$\n]{10,80}?)\s*\$(\d{1,3}(?:\.\d{2})?)/g,
        // Price: $XX for Product
        /\$(\d{1,3}(?:\.\d{2})?)\s*(?:for|[-–])\s*([A-Za-z][A-Za-z0-9\s\-\']{10,60})/gi,
    ];
    
    for (const pattern of patterns) {
        let m;
        while ((m = pattern.exec(content)) !== null) {
            let price, title;
            
            // Figure out which group is price vs title
            if (/^\d+\.?\d*$/.test(m[1])) {
                price = parseFloat(m[1]);
                title = m[2]?.trim();
            } else {
                title = m[1]?.trim();
                price = parseFloat(m[2]);
            }
            
            if (!title || !price) continue;
            if (price < 2 || price > 1500) continue;
            if (title.length < 8 || title.length > 120) continue;
            
            // Clean title
            title = title
                .replace(/\s+/g, ' ')
                .replace(/^\W+|\W+$/g, '')
                .trim();
            
            // Skip junk
            if (/^(shop|buy|add|view|see|click|more|free|sale|save|sign|log|cart)/i.test(title)) continue;
            if (!/[aeiou]/i.test(title)) continue; // Must have vowels
            
            const key = title.toLowerCase().slice(0, 30) + '-' + price;
            if (seen.has(key)) continue;
            seen.add(key);
            
            products.push({ 
                title, 
                price, 
                store_domain: store, 
                url: 'https://' + store, 
                category: cat, 
                source: 'jina' 
            });
        }
    }
    
    return products;
}

async function main() {
    const db = createDB(); 
    await initDB(db);
    let total = 0;
    
    console.log('\n🤖 Jina Scraper v2 - Better extraction\n');
    
    for (let i = 0; i < PAGES.length; i++) {
        const { url, store, cat } = PAGES[i];
        console.log(`[${i+1}/${PAGES.length}] ${store} (${cat})`);
        
        await registerStore(db, { domain: store, platform: 'retail' });
        const content = await fetchJina(url);
        
        if (!content) { 
            console.log('   ❌ Failed to fetch\n');
            continue; 
        }
        
        // Debug: save first response to see format
        if (i === 0) {
            writeFileSync('debug-jina-output.md', content);
            console.log('   📝 Saved debug output to debug-jina-output.md');
        }
        
        const products = extract(content, store, cat);
        
        for (const p of products) await upsertProduct(db, p);
        console.log(`   ✅ ${products.length} products\n`);
        total += products.length;
        
        await new Promise(r => setTimeout(r, 2500));
    }
    
    const stats = await db.execute('SELECT COUNT(*) as c FROM products');
    console.log(`\n✅ Added ${total} products. Total in DB: ${stats.rows[0].c}`);
    
    // Show recent additions
    const recent = await db.execute(`
        SELECT title, price, store_domain FROM products 
        WHERE source = 'jina' 
        ORDER BY created_at DESC LIMIT 10
    `);
    console.log('\n📝 Recent Jina products:');
    for (const r of recent.rows) {
        console.log(`   $${r.price} - ${r.title.substring(0,50)} (${r.store_domain})`);
    }
}
main();
