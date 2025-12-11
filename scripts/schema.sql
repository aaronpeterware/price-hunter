-- Products table - stores all product data from all stores
CREATE TABLE IF NOT EXISTS products (
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
    source TEXT DEFAULT 'scrape',  -- 'scrape', 'user', 'affiliate_feed'
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_normalized_title ON products(normalized_title);
CREATE INDEX IF NOT EXISTS idx_store_domain ON products(store_domain);
CREATE INDEX IF NOT EXISTS idx_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_upc ON products(upc);
CREATE INDEX IF NOT EXISTS idx_image_hash ON products(image_hash);
CREATE INDEX IF NOT EXISTS idx_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_updated_at ON products(updated_at);

-- Stores table - track stores we've scraped
CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    name TEXT,
    platform TEXT DEFAULT 'shopify',  -- 'shopify', 'woocommerce', 'custom'
    product_count INTEGER DEFAULT 0,
    last_scraped INTEGER,
    scrape_frequency_hours INTEGER DEFAULT 24,
    affiliate_network TEXT,
    affiliate_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch())
);

-- Search demand tracking - what are users looking for?
CREATE TABLE IF NOT EXISTS search_demand (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    normalized_title TEXT NOT NULL UNIQUE,
    search_count INTEGER DEFAULT 1,
    last_searched INTEGER DEFAULT (unixepoch()),
    has_results INTEGER DEFAULT 0
);

-- User price reports - crowdsourced price data
CREATE TABLE IF NOT EXISTS price_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    reported_price REAL NOT NULL,
    store_domain TEXT NOT NULL,
    url TEXT NOT NULL,
    user_id TEXT,  -- anonymous identifier
    reported_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Full text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    title,
    normalized_title,
    vendor,
    category,
    content='products',
    content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
    INSERT INTO products_fts(rowid, title, normalized_title, vendor, category)
    VALUES (new.id, new.title, new.normalized_title, new.vendor, new.category);
END;

CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, title, normalized_title, vendor, category)
    VALUES ('delete', old.id, old.title, old.normalized_title, old.vendor, old.category);
END;

CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
    INSERT INTO products_fts(products_fts, rowid, title, normalized_title, vendor, category)
    VALUES ('delete', old.id, old.title, old.normalized_title, old.vendor, old.category);
    INSERT INTO products_fts(rowid, title, normalized_title, vendor, category)
    VALUES (new.id, new.title, new.normalized_title, new.vendor, new.category);
END;
