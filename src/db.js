import { createClient } from '@libsql/client';

// Database connection - works with both local SQLite and Turso
export function createDB() {
    // Use Turso if credentials provided, otherwise local SQLite
    if (process.env.TURSO_URL && process.env.TURSO_AUTH_TOKEN) {
        console.log('🌐 Connecting to Turso...');
        return createClient({
            url: process.env.TURSO_URL,
            authToken: process.env.TURSO_AUTH_TOKEN
        });
    } else {
        console.log('📁 Using local SQLite database...');
        return createClient({
            url: 'file:./data/products.db'
        });
    }
}

// Initialize database with schema
export async function initDB(db) {
    const statements = [
        // Products table
        `CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            normalized_title TEXT NOT NULL,
            price REAL NOT NULL,
            currency TEXT DEFAULT 'USD',
            store_domain TEXT NOT NULL,
            store_name TEXT,
            url TEXT NOT NULL UNIQUE,
            image_url TEXT,
            image_hash TEXT,
            upc TEXT,
            sku TEXT,
            vendor TEXT,
            category TEXT,
            affiliate_url TEXT,
            in_stock INTEGER DEFAULT 1,
            source TEXT DEFAULT 'scrape',
            created_at INTEGER DEFAULT (unixepoch()),
            updated_at INTEGER DEFAULT (unixepoch())
        )`,
        
        // Stores table
        `CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL UNIQUE,
            name TEXT,
            platform TEXT DEFAULT 'shopify',
            product_count INTEGER DEFAULT 0,
            last_scraped INTEGER,
            scrape_frequency_hours INTEGER DEFAULT 24,
            affiliate_network TEXT,
            affiliate_id TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (unixepoch())
        )`,
        
        // Search demand tracking
        `CREATE TABLE IF NOT EXISTS search_demand (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            normalized_title TEXT NOT NULL UNIQUE,
            search_count INTEGER DEFAULT 1,
            last_searched INTEGER DEFAULT (unixepoch()),
            has_results INTEGER DEFAULT 0
        )`,
        
        // Indexes
        `CREATE INDEX IF NOT EXISTS idx_normalized_title ON products(normalized_title)`,
        `CREATE INDEX IF NOT EXISTS idx_store_domain ON products(store_domain)`,
        `CREATE INDEX IF NOT EXISTS idx_price ON products(price)`,
        `CREATE INDEX IF NOT EXISTS idx_category ON products(category)`
    ];
    
    for (const sql of statements) {
        try {
            await db.execute(sql);
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.error('Schema error:', err.message);
            }
        }
    }
    
    console.log('✅ Database initialized');
}

// Normalize product title for matching
export function normalizeTitle(title) {
    if (!title) return '';
    
    return title
        .toLowerCase()
        // Remove special characters except spaces
        .replace(/[^a-z0-9\s]/g, ' ')
        // Standardize units
        .replace(/(\d+)\s*(oz|ounce|ounces)/gi, '$1oz')
        .replace(/(\d+)\s*(ml|milliliter|milliliters)/gi, '$1ml')
        .replace(/(\d+)\s*(g|gram|grams)/gi, '$1g')
        .replace(/(\d+)\s*(lb|lbs|pound|pounds)/gi, '$1lb')
        .replace(/(\d+)\s*(ct|count)/gi, '$1ct')
        .replace(/(\d+)\s*(pk|pack)/gi, '$1pk')
        // Remove filler words
        .replace(/\b(the|a|an|and|or|for|with|new|free|best|top|premium|professional|pro)\b/gi, '')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

// Insert or update a product
export async function upsertProduct(db, product) {
    const normalized = normalizeTitle(product.title);
    
    await db.execute({
        sql: `INSERT INTO products (
                title, normalized_title, price, currency, store_domain, 
                store_name, url, image_url, vendor, category, source, updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
              ON CONFLICT(url) DO UPDATE SET 
                price = excluded.price,
                in_stock = excluded.in_stock,
                updated_at = unixepoch()`,
        args: [
            product.title,
            normalized,
            product.price,
            product.currency || 'USD',
            product.store_domain,
            product.store_name || null,
            product.url,
            product.image_url || null,
            product.vendor || null,
            product.category || null,
            product.source || 'scrape'
        ]
    });
}

// Find alternatives from our database
export async function findAlternatives(db, product, limit = 10) {
    const normalized = normalizeTitle(product.title);
    
    // Try exact normalized title match first
    let results = await db.execute({
        sql: `SELECT * FROM products 
              WHERE normalized_title = ?
              AND store_domain != ?
              AND in_stock = 1
              ORDER BY price ASC
              LIMIT ?`,
        args: [normalized, product.store_domain, limit]
    });
    
    if (results.rows.length > 0) {
        return { results: results.rows, match_type: 'exact' };
    }
    
    // Try LIKE match with key terms
    const terms = normalized.split(' ').filter(t => t.length > 3).slice(0, 3);
    if (terms.length > 0) {
        const likePattern = '%' + terms.join('%') + '%';
        results = await db.execute({
            sql: `SELECT * FROM products 
                  WHERE normalized_title LIKE ?
                  AND store_domain != ?
                  AND in_stock = 1
                  ORDER BY price ASC
                  LIMIT ?`,
            args: [likePattern, product.store_domain, limit]
        });
        
        return { results: results.rows, match_type: 'fuzzy' };
    }
    
    return { results: [], match_type: 'none' };
}

// Track search demand for products we don't have
export async function trackSearchDemand(db, title) {
    const normalized = normalizeTitle(title);
    
    await db.execute({
        sql: `INSERT INTO search_demand (normalized_title, search_count, last_searched)
              VALUES (?, 1, unixepoch())
              ON CONFLICT(normalized_title) DO UPDATE SET
                search_count = search_count + 1,
                last_searched = unixepoch()`,
        args: [normalized]
    });
}

// Get high-demand products we should prioritize finding
export async function getHighDemandProducts(db, limit = 100) {
    return await db.execute({
        sql: `SELECT * FROM search_demand 
              WHERE has_results = 0 
              ORDER BY search_count DESC 
              LIMIT ?`,
        args: [limit]
    });
}

// Register a store we want to track
export async function registerStore(db, store) {
    await db.execute({
        sql: `INSERT INTO stores (domain, name, platform, affiliate_network, affiliate_id)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(domain) DO UPDATE SET
                name = excluded.name,
                affiliate_network = excluded.affiliate_network,
                affiliate_id = excluded.affiliate_id`,
        args: [
            store.domain,
            store.name || null,
            store.platform || 'shopify',
            store.affiliate_network || null,
            store.affiliate_id || null
        ]
    });
}

// Update store scrape stats
export async function updateStoreStats(db, domain, productCount) {
    await db.execute({
        sql: `UPDATE stores SET 
              product_count = ?, 
              last_scraped = unixepoch() 
              WHERE domain = ?`,
        args: [productCount, domain]
    });
}

// Get database stats
export async function getStats(db) {
    const products = await db.execute('SELECT COUNT(*) as count FROM products');
    const stores = await db.execute('SELECT COUNT(*) as count FROM stores');
    const recentProducts = await db.execute(
        `SELECT COUNT(*) as count FROM products WHERE updated_at > unixepoch() - 86400`
    );
    
    return {
        total_products: products.rows[0].count,
        total_stores: stores.rows[0].count,
        products_updated_24h: recentProducts.rows[0].count
    };
}
