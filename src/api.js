import { createServer } from 'http';
import { createDB, initDB, upsertProduct, findAlternatives, trackSearchDemand, getStats, normalizeTitle } from './db.js';

const PORT = process.env.PORT || 3000;

// Initialize database
const db = createDB();
await initDB(db);

// Simple JSON response helper
function json(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

// Parse JSON body
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
    });
}

// Request handler
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // Routes
    try {
        // Health check
        if (path === '/' || path === '/health') {
            return json(res, { status: 'ok', timestamp: new Date().toISOString() });
        }
        
        // Get database stats
        if (path === '/api/stats') {
            const stats = await getStats(db);
            return json(res, stats);
        }
        
        // Main endpoint: Find alternatives
        // Called when user views a product page
        if (path === '/api/find-alternatives' && req.method === 'POST') {
            const body = await parseBody(req);
            
            const { title, price, store_domain, url: productUrl, image_url } = body;
            
            if (!title || !store_domain) {
                return json(res, { error: 'Missing required fields: title, store_domain' }, 400);
            }
            
            // 1. Learn this price (crowdsourced intelligence)
            if (price && productUrl) {
                await upsertProduct(db, {
                    title,
                    price: parseFloat(price),
                    store_domain,
                    url: productUrl,
                    image_url,
                    source: 'user_report'
                });
            }
            
            // 2. Find alternatives
            const { results, match_type } = await findAlternatives(db, {
                title,
                store_domain,
                price: parseFloat(price) || 0
            });
            
            // 3. Track demand if no results (helps us prioritize what to scrape)
            if (results.length === 0) {
                await trackSearchDemand(db, title);
            }
            
            // 4. Format response
            const alternatives = results.map(r => ({
                title: r.title,
                price: r.price,
                store: r.store_domain,
                url: r.url,
                image_url: r.image_url,
                savings: price ? (parseFloat(price) - r.price).toFixed(2) : null
            }));
            
            return json(res, {
                query: { title, price, store: store_domain },
                match_type,
                alternatives_count: alternatives.length,
                alternatives: alternatives.slice(0, 10),
                cheapest: alternatives[0] || null
            });
        }
        
        // Bulk product report (extension sends batch of seen products)
        if (path === '/api/report-products' && req.method === 'POST') {
            const body = await parseBody(req);
            const { products } = body;
            
            if (!Array.isArray(products)) {
                return json(res, { error: 'Expected products array' }, 400);
            }
            
            let saved = 0;
            for (const p of products) {
                if (p.title && p.price && p.store_domain && p.url) {
                    await upsertProduct(db, {
                        ...p,
                        price: parseFloat(p.price),
                        source: 'user_report'
                    });
                    saved++;
                }
            }
            
            return json(res, { saved, total: products.length });
        }
        
        // Search products in our database
        if (path === '/api/search' && req.method === 'GET') {
            const query = url.searchParams.get('q');
            const limit = parseInt(url.searchParams.get('limit')) || 20;
            
            if (!query) {
                return json(res, { error: 'Missing query parameter: q' }, 400);
            }
            
            const normalized = normalizeTitle(query);
            const terms = normalized.split(' ').filter(t => t.length > 2).slice(0, 5);
            const likePattern = '%' + terms.join('%') + '%';
            
            const results = await db.execute({
                sql: `SELECT * FROM products 
                      WHERE normalized_title LIKE ?
                      ORDER BY price ASC
                      LIMIT ?`,
                args: [likePattern, limit]
            });
            
            return json(res, {
                query,
                count: results.rows.length,
                results: results.rows
            });
        }
        
        // 404
        return json(res, { error: 'Not found' }, 404);
        
    } catch (err) {
        console.error('Error:', err);
        return json(res, { error: 'Internal server error' }, 500);
    }
}

// Create server
const server = createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 Price Hunter API Server                             ║
║                                                          ║
║   Running on http://localhost:${PORT}                       ║
║                                                          ║
║   Endpoints:                                             ║
║   • GET  /health              - Health check             ║
║   • GET  /api/stats           - Database statistics      ║
║   • POST /api/find-alternatives - Find cheaper options   ║
║   • POST /api/report-products - Bulk product report      ║
║   • GET  /api/search?q=       - Search products          ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
});
