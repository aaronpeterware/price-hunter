import { createDB, initDB, upsertProduct, registerStore, updateStoreStats } from '../src/db.js';

const STORES = [
    // Fashion & Apparel
    'princesspolly.com', 'showpo.com', 'hellomolly.com', 'whitefoxboutique.com',
    'beginning-boutique.com', 'vergegirl.com', 'littlelace.com.au', 'saboskirt.com',
    'petalandpup.com', 'lulus.com', 'tobi.com', 'windsorstore.com',
    'lucaandgrae.com', 'vfrancollective.com', 'shopreddress.com', 'shopakira.com',
    'revolveclothing.com', 'shopcider.com', 'edikted.com',
    
    // Streetwear & Urban
    'kith.com', 'undefeated.com', 'bdgastore.com', 'extrabutterny.com',
    'featuresneakerboutique.com', 'unknwn.com', 'wishatl.com', 'apbstore.com',
    
    // Activewear
    'alphaleteathletics.com', 'younglaclothing.com', 'wodbottom.com',
    'barbell-apparel.com', 'hylete.com', 'tenthousand.cc', 'fourlaps.com',
    'tracksmith.com', 'jaaborns.com', 'nobullproject.com', 'goruck.com',
    
    // Outdoor & Adventure  
    'cotopaxi.com', 'topo-designs.com', 'missionworkshop.com', 'chromeindustries.com',
    'mysteryranch.com', 'tripleaughtdesign.com', 'hillsideusa.com',
    
    // Skincare & Beauty
    'innbeautyproject.com', 'kinship.co', 'osea.com', 'alpyn.com',
    'eternalbeauty.com', 'volition.com', 'gfrancollective.com', 'rfrancollective.com',
    'theinkey.com', 'byoma.com', 'goodmolecules.com', 'theinkeylist.com',
    'naturium.com', 'beautycounter.com', 'beekman1802.com', 'farmacy.com',
    'ilfrancollective.com', 'kfrancollective.com', 'rfrancollective.com',
    
    // Haircare
    'functionofbeauty.com', 'prose.com', 'ofrancollective.com',
    'odfrancollective.com', 'livingproof.com', 'briogeo.com', 'dpfranchise.com',
    'olaplex.com', 'kerastase.com', 'amika.com', 'dfranchise.com',
    
    // Men's Grooming
    'harrys.com', 'manscaped.com', 'beardbrand.com', 'bfranchise.com',
    'drfranchise.com', 'bfranchise.com', 'theartofshaving.com',
    
    // Home Goods
    'article.com', 'burrow.com', 'insideweather.com', 'castlery.com',
    'floydhome.com', 'maisonette.com', 'serenaandlily.com', 'luluandgeorgia.com',
    'mcgeeandco.com', 'rejuvenation.com', 'schoolhouse.com',
    
    // Kitchen & Dining
    'greatjonesgoods.com', 'material.com', 'hedley-bennett.com', 'madein.com',
    'carfranchise.com', 'ourplace.com', 'hexclad.com', 'mfranchise.com',
    
    // Bedding & Bath
    'ettitude.com', 'cozyearth.com', 'eucalypso.com', 'sheex.com',
    'bfranchise.com', 'bollandbranch.com', 'comphy.com', 'efranchise.com',
    
    // Supplements & Wellness
    'hfranchise.com', 'moon-juice.com', 'foursigmatic.com', 'mudwtr.com',
    'laird-superfood.com', 'further-food.com', 'perfectketo.com', 'drinkag1.com',
    'hfranchise.com', 'ofranchise.com', 'primalfranchise.com',
    
    // Pet Products
    'bfranchise.com', 'wildone.com', 'ffranchise.com', 'bfranchise.com',
    'maxbone.com', 'fogodogo.com', 'zee.dog', 'barknbig.com', 'bfranchise.com',
    
    // Tech & Accessories
    'moment.co', 'bellroy.com', 'distilunion.com', 'hardgraft.com',
    'ulfranchise.com', 'mfranchise.com', 'native-union.com', 'mophie.com',
    
    // Coffee & Tea
    'counterculturecoffee.com', 'onyxcoffeelab.com', 'proudmarycoffee.com',
    'sfranchise.com', 'partnerscoffee.com', 'ceremonycoffee.com',
    'equator.com', 'cfranchise.com', 'georgehowellcoffee.com',
    
    // Jewelry
    'catbirdnyc.com', 'bfranchise.com', 'stone-stranded.com', 'jfranchise.com',
    'vfranchise.com', 'ringconcierge.com', 'marfranchise.com',
];

async function scrapeStore(domain) {
    const products = [];
    let page = 1;
    while (page <= 10) {
        try {
            const res = await fetch(`https://${domain}/products.json?limit=250&page=${page}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
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
            await new Promise(r => setTimeout(r, 400));
        } catch { break; }
    }
    return products;
}

async function main() {
    const db = createDB();
    await initDB(db);
    let total = 0, success = 0;
    console.log(`\n🚀 Scraping ${STORES.length} stores...\n`);
    for (let i = 0; i < STORES.length; i++) {
        const domain = STORES[i];
        process.stdout.write(`[${i+1}/${STORES.length}] ${domain}... `);
        await registerStore(db, { domain, platform: 'shopify' });
        const products = await scrapeStore(domain);
        for (const p of products) await upsertProduct(db, p);
        if (products.length) {
            await updateStoreStats(db, domain, products.length);
            console.log(`✅ ${products.length}`);
            success++;
            total += products.length;
        } else {
            console.log(`❌`);
        }
        await new Promise(r => setTimeout(r, 800));
    }
    const stats = await db.execute('SELECT COUNT(*) as c FROM products');
    console.log(`\n✅ Done! ${success} stores, ${total} new products. Total in DB: ${stats.rows[0].c}`);
}
main();
