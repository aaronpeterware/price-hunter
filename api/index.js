import { createClient } from '@libsql/client';

const db = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

function normalizeTitle(title) {
    if (!title) return '';
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    
    try {
        if (path === '/' || path === '/health' || path === '/api' || path === '/api/') {
            return res.json({ status: 'ok', service: 'price-hunter' });
        }
        
        if (path === '/api/stats') {
            const p = await db.execute('SELECT COUNT(*) as count FROM products');
            const s = await db.execute('SELECT COUNT(DISTINCT store_domain) as count FROM products');
            return res.json({ total_products: p.rows[0].count, total_stores: s.rows[0].count });
        }
        
        if (path === '/api/find-alternatives' && req.method === 'POST') {
            const { title, price, store_domain } = req.body || {};
            if (!title) return res.status(400).json({ error: 'Missing title' });
            const normalized = normalizeTitle(title);
            let results = await db.execute({
                sql: 'SELECT * FROM products WHERE normalized_title = ? AND store_domain != ? ORDER BY price ASC LIMIT 10',
                args: [normalized, store_domain || '']
            });
            let matchType = 'exact';
            if (results.rows.length === 0) {
                const terms = normalized.split(' ').filter(t => t.length > 3).slice(0, 4);
                if (terms.length > 0) {
                    results = await db.execute({
                        sql: 'SELECT * FROM products WHERE normalized_title LIKE ? AND store_domain != ? ORDER BY price ASC LIMIT 10',
                        args: ['%' + terms.join('%') + '%', store_domain || '']
                    });
                    matchType = 'fuzzy';
                }
            }
            const alternatives = results.rows.map(r => ({
                title: r.title, price: r.price, store: r.store_domain, url: r.url,
                savings: price ? (parseFloat(price) - r.price).toFixed(2) : null
            }));
            return res.json({ match_type: matchType, alternatives_count: alternatives.length, alternatives, cheapest: alternatives[0] || null });
        }
        
        if (path === '/api/search') {
            const q = url.searchParams.get('q');
            if (!q) return res.status(400).json({ error: 'Missing q' });
            const pattern = '%' + normalizeTitle(q).split(' ').filter(t => t.length > 2).join('%') + '%';
            const results = await db.execute({ sql: 'SELECT * FROM products WHERE normalized_title LIKE ? ORDER BY price ASC LIMIT 20', args: [pattern] });
            return res.json({ query: q, count: results.rows.length, results: results.rows });
        }
        
        return res.status(404).json({ error: 'Not found' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error', details: err.message });
    }
}
