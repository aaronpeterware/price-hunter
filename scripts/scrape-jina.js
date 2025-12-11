import { createDB, initDB, upsertProduct, registerStore } from '../src/db.js';

const JINA_API_KEY = 'jina_3d4f6fc18773417b85622e6c5a62b40fIUT3oHdGfQUu8TZsY476hDMd4Lg-';

const PAGES = [
    { url: 'https://www.amazon.com/Best-Sellers-Beauty/zgbs/beauty', store: 'amazon.com', cat: 'beauty' },
    { url: 'https://www.amazon.com/Best-Sellers-Skin-Care/zgbs/beauty/11060451', store: 'amazon.com', cat: 'skincare' },
    { url: 'https://www.amazon.com/Best-Sellers-Electronics/zgbs/electronics', store: 'amazon.com', cat: 'electronics' },
    { url: 'https://www.target.com/c/skin-care-beauty/-/N-5xtzq', store: 'target.com', cat: 'skincare' },
    { url: 'https://www.target.com/c/makeup-beauty/-/N-5xu2b', store: 'target.com', cat: 'makeup' },
    { url: 'https://www.walmart.com/browse/beauty/skin-care/1085666_1071970', store: 'walmart.com', cat: 'skincare' },
    { url: 'https://www.walmart.com/browse/beauty/makeup/1085666_1071969', store: 'walmart.com', cat: 'makeup' },
    { url: 'https://www.ulta.com/skin-care/moisturizers', store: 'ulta.com', cat: 'skincare' },
    { url: 'https://www.sephora.com/shop/moisturizing-cream-oils-mists', store: 'sephora.com', cat: 'skincare' },
    { url: 'https://www.bestbuy.com/site/headphones/all-headphones/pcmcat144700050004.c', store: 'bestbuy.com', cat: 'electronics' },
    { url: 'https://www.cvs.com/shop/skin-care/facial-moisturizers', store: 'cvs.com', cat: 'skincare' },
];

async function fetchJina(url) {
    try {
        const res = await fetch('https://r.jina.ai/' + url, {
            headers: { 'Authorization': 'Bearer ' + JINA_API_KEY, 'X-Return-Format': 'markdown' },
            signal: AbortSignal.timeout(30000)
        });
        return res.ok ? await res.text() : null;
    } catch { return null; }
}

function extract(content, store, cat) {
    const products = [], seen = new Set();
    const regex = /\$(\d+\.?\d*)[^A-Za-z]*([A-Z][A-Za-z0-9\s\-\'\,\.]+)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        const price = parseFloat(m[1]), title = m[2].trim();
        if (price < 1 || price > 2000 || title.length < 5 || title.length > 100) continue;
        const key = title.toLowerCase().slice(0, 25);
        if (seen.has(key)) continue;
        seen.add(key);
        products.push({ title, price, store_domain: store, url: 'https://' + store, category: cat, source: 'jina' });
    }
    return products;
}

async function main() {
    const db = createDB(); await initDB(db);
    let total = 0;
    console.log('\n🤖 Jina Scraper - Amazon/Target/Walmart/etc\n');
    for (let i = 0; i < PAGES.length; i++) {
        const { url, store, cat } = PAGES[i];
        process.stdout.write('[' + (i+1) + '/' + PAGES.length + '] ' + store + ' (' + cat + ')... ');
        await registerStore(db, { domain: store, platform: 'retail' });
        const content = await fetchJina(url);
        if (!content) { console.log('❌'); continue; }
        const products = extract(content, store, cat);
        for (const p of products) await upsertProduct(db, p);
        console.log('✅ ' + products.length);
        total += products.length;
        await new Promise(r => setTimeout(r, 2000));
    }
    const stats = await db.execute('SELECT COUNT(*) as c FROM products');
    console.log('\n✅ Added ' + total + ' products. Total: ' + stats.rows[0].c);
}
main();
