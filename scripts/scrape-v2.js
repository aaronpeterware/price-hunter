import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

const STORES = [
    'gymshark.com',
    'fashionnova.com', 
    'allbirds.com',
    'bombas.com',
    'mejuri.com',
    'ruggable.com',
    'brooklinen.com',
    'away.com',
    'rothys.com',
    'chubbiesshorts.com',
    'puravidabracelets.com',
    'mvmtwatches.com',
    'hauslabs.com',
    'skims.com',
    'ouai.com',
    'summerfridays.com',
    'kosas.com',
    'cocokind.com',
    'starface.world',
    'hero.co',
    'peachandlily.com',
    'tula.com',
    'supergoop.com',
    'drinktrade.com',
    'bluebottlecoffee.com',
    'vervecoffe.com',
    'ritual.com',
    'seed.com',
    'care-of.com',
    'hfranchise.com',
];

async function scrapeStore(domain) {
    const products = [];
    let page = 1;
    while (page <= 10) {
        try {
            const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) break;
            const data = await res.json();
            if (!data.products?.length) break;
            for (const p of data.products) {
                const v = p.variants?.[0];
                if (!v) continue;
                products.push({
                    title: p.title, 
                    price: parseFloat(v.price), 
                    store_domain: domain,
                    url: `https://${domain}/products/${p.handle}`,
                    image_url: p.images?.[0]?.src, 
                    vendor: p.vendor,
                    category: p.product_type, 
                    source: 'shopify_scrape'
                });
            }
            if (data.products.length < 250) break;
            page++;
            await new Promise(r => setTimeout(r, 500));
        } catch (e) { 
            console.log(`Error: ${e.message}`);
            break; 
        }
    }
    return products;
}

async function main() {
    const db = createDB();
    await initDB(db);
    let total = 0;
    console.log(`\n🚀 Scraping ${STORES.length} verified Shopify stores...\n`);
    for (let i = 0; i < STORES.length; i++) {
        const domain = STORES[i];
        process.stdout.write(`[${i+1}/${STORES.length}] ${domain}... `);
        await registerStore(db, { domain, platform: 'shopify' });
        const products = await scrapeStore(domain);
        for (const p of products) await upsertProduct(db, p);
        await updateStoreStats(db, domain, products.length);
        console.log(products.length ? `✅ ${products.length} products` : `❌ failed`);
        total += products.length;
        await new Promise(r => setTimeout(r, 1000));
    }
    const stats = await db.execute('SELECT COUNT(*) as c FROM products');
    console.log(`\n✅ Done! Added ${total} products. Total in DB: ${stats.rows[0].c}`);
}
main();
