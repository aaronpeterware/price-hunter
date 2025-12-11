import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

const STORES = [
    'colourpop.com', 'kyliecosmetics.com', 'glossier.com', 'fentybeauty.com',
    'milkmakeup.com', 'tartecosmetics.com', 'morphe.com', 'hudabeauty.com',
    'charlottetilbury.com', 'kosas.com', 'rarebeauty.com', 'limecrime.com',
    'patmcgrath.com', 'toofaced.com', 'theordinary.com', 'summerfridays.com',
    'tatcha.com', 'sundayriley.com', 'olehenriksen.com', 'mariobadescu.com',
    'youthtothepeople.com', 'herbivore.com', 'cocokind.com', 'versed.com',
    'tula.com', 'biossance.com', 'fashionnova.com', 'gymshark.com',
    'chubbiesshorts.com', 'mvmtwatches.com', 'puravidabracelets.com',
    'princesspolly.com', 'showpo.com', 'hellomolly.com', 'thereformation.com',
    'everlane.com', 'alphalete.com', 'youngla.com', 'buffbunny.com',
    'nvgtn.com', 'outdoorvoices.com', 'vuoriclothing.com', 'allbirds.com',
    'rothys.com', 'greats.com', 'brooklinen.com', 'parachutehome.com',
    'casper.com', 'purple.com', 'eightsleep.com', 'athleticgreens.com',
    'liquid-iv.com', 'vitalproteins.com', 'ghostlifestyle.com',
    'drinkmudwtr.com', 'magicspoon.com', 'bluebottlecoffee.com',
    'blackriflecoffee.com', 'deathwishcoffee.com', 'casetify.com',
    'nomadgoods.com', 'peakdesign.com', 'dbrand.com', 'away.com',
    'monos.com', 'mejuri.com', 'analuisa.com', 'gorjana.com',
    'kendrascott.com', 'baublebar.com', 'warbyparker.com', 'goodr.com',
];

async function scrapeStore(domain) {
    const products = [];
    let page = 1;
    while (page <= 10) {
        try {
            const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) break;
            const data = await res.json();
            if (!data.products?.length) break;
            for (const p of data.products) {
                const v = p.variants?.[0];
                if (!v || v.available === false) continue;
                products.push({
                    title: p.title, price: parseFloat(v.price), store_domain: domain,
                    url: `https://${domain}/products/${p.handle}`,
                    image_url: p.images?.[0]?.src, vendor: p.vendor,
                    category: p.product_type, source: 'shopify_scrape'
                });
            }
            if (data.products.length < 250) break;
            page++;
            await new Promise(r => setTimeout(r, 300));
        } catch { break; }
    }
    return products;
}

async function main() {
    const db = createDB();
    await initDB(db);
    let total = 0;
    console.log(`\n🚀 Scraping ${STORES.length} stores...\n`);
    for (let i = 0; i < STORES.length; i++) {
        const domain = STORES[i];
        process.stdout.write(`[${i+1}/${STORES.length}] ${domain}... `);
        await registerStore(db, { domain, platform: 'shopify' });
        const products = await scrapeStore(domain);
        for (const p of products) await upsertProduct(db, p);
        await updateStoreStats(db, domain, products.length);
        console.log(products.length ? `✅ ${products.length}` : '❌');
        total += products.length;
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`\n✅ Done! ${total} products scraped.`);
}
main();import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

const STORES = [
    // Beauty
    'colourpop.com', 'kyliecosmetics.com', 'glossier.com', 'fentybeauty.com',
    'milkmakeup.com', 'tartecosmetics.com', 'morphe.com', 'hudabeauty.com',
    'charlottetilbury.com', 'kosas.com', 'rarebeauty.com', 'limecrime.com',
    'patmcgrath.com', 'anastasiabeverlyhills.com', 'toofaced.com',
    // Skincare
    'theordinary.com', 'drunk-elephant.com', 'summerfridays.com', 'tatcha.com',
    'sundayriley.com', 'olehenriksen.com', 'mariobadescu.com', 'youthtothepeople.com',
    'herbivore.com', 'cocokind.com', 'versed.com', 'tula.com', 'biossance.com',
    // Fashion
    'fashionnova.com', 'gymshark.com', 'chubbiesshorts.com', 'mvmtwatches.com',
    'puravidabracelets.com', 'princesspolly.com', 'showpo.com', 'hellomolly.com',
    'thereformation.com', 'everlane.com', 'kotn.com',
    // Activewear
    'alphalete.com', 'youngla.com', 'buffbunny.com', 'nvgtn.com',
    'outdoorvoices.com', 'vuoriclothing.com', 'rhone.com',
    // Footwear
    'allbirds.com', 'rothys.com', 'greats.com', 'koio.co', 'olivercabell.com',
    // Home
    'brooklinen.com', 'parachutehome.com', 'burrow.com', 'casper.com',
    'purple.com', 'tuftandneedle.com', 'eightsleep.com',
    // Supplements
    'athleticgreens.com', 'liquid-iv.com', 'vitalproteins.com',
    'transparentlabs.com', 'legionathletics.com', 'ghostlifestyle.com',
    // Food/Bev
    'drinkmudwtr.com', 'magicspoon.com', 'rxbar.com',
    // Coffee
    'bluebottlecoffee.com', 'stumptowncoffee.com', 'counterculturecoffee.com',
    'blackriflecoffee.com', 'deathwishcoffee.com',
    // Tech
    'casetify.com', 'nomadgoods.com', 'peakdesign.com', 'dbrand.com',
    'anker.com', 'satechi.net', 'grovemade.com',
    // Bags
    'away.com', 'monos.com', 'calpaktravel.com', 'dagnedover.com',
    // Jewelry
    'mejuri.com', 'analuisa.com', 'gorjana.com', 'kendrascott.com', 'baublebar.com',
    // Eyewear
    'warbyparker.com', 'sunski.com', 'goodr.com', 'knockaround.com',
];

async function scrapeStore(domain) {
    const products = [];
    let page = 1;
    while (page <= 10) {
        try {
            const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                signal: AbortSignal.timeout(10000)
            });
            if (!res.ok) break;
            const data = await res.json();
            if (!data.products?.length) break;
            for (const p of data.products) {
                const v = p.variants?.[0];
                if (!v || v.available === false) continue;
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
            await new Promise(r => setTimeout(r, 300));
        } catch { break; }
    }
    return products;
}

async function main() {
    const db = createDB();
    await initDB(db);
    let total = 0;
    console.log(`\n🚀 Scraping ${STORES.length} stores...\n`);
    for (let i = 0; i < STORES.length; i++) {
        const domain = STORES[i];
        process.stdout.write(`[${i+1}/${STORES.length}] ${domain}... `);
        await registerStore(db, { domain, platform: 'shopify' });
        const products = await scrapeStore(domain);
        for (const p of products) await upsertProduct(db, p);
        await updateStoreStats(db, domain, products.length);
        console.log(products.length ? `✅ ${products.length}` : '❌');
        total += products.length;
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`\n✅ Done! ${total} products scraped.`);
}
main();
