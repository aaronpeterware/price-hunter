# 🔍 Price Hunter

**Find the same products cheaper elsewhere. Instantly.**

A price comparison platform that:
- Runs as a browser extension
- Detects when you're on a product page
- Shows you cheaper alternatives from other stores
- Learns prices from users (crowdsourced intelligence)
- Costs near-zero to operate

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies

```bash
cd price-hunter
npm install
```

### 2. Seed the Database

```bash
# Using mock data (for testing)
node scripts/seed-mock-data.js

# OR scrape real Shopify stores (run locally, not in restricted environments)
npm run scrape
```

### 3. Start the API Server

```bash
npm run api
# Server runs at http://localhost:3000
```

### 4. Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The Price Hunter icon should appear in your toolbar

### 5. Test It

1. Go to any product page (Amazon, Target, Walmart, etc.)
2. The extension will automatically detect the product
3. If alternatives exist in the database, an overlay will appear

---

## 📁 Project Structure

```
price-hunter/
├── src/
│   ├── db.js           # Database utilities
│   └── api.js          # API server
├── scripts/
│   ├── schema.sql      # Database schema
│   ├── scrape-shopify.js    # Shopify store scraper
│   ├── seed-mock-data.js    # Mock data seeder
│   └── generate-icons.js    # Icon generator
├── extension/
│   ├── manifest.json   # Extension manifest
│   ├── content.js      # Runs on product pages
│   ├── content.css     # Overlay styles
│   ├── background.js   # Service worker
│   ├── popup.html      # Extension popup
│   ├── popup.js        # Popup logic
│   └── icons/          # Extension icons
└── data/
    └── products.db     # SQLite database (created automatically)
```

---

## 🗄️ Database Options

### Local SQLite (Default)

Perfect for development. Just run the app, database is created automatically.

```bash
# Data stored in ./data/products.db
npm run api
```

### Turso (Production)

For production, use [Turso](https://turso.tech) - SQLite at the edge with 9GB free tier.

```bash
# 1. Install Turso CLI
brew install tursodatabase/tap/turso

# 2. Create account and database
turso auth login
turso db create price-hunter

# 3. Get credentials
turso db show price-hunter --url
turso db tokens create price-hunter

# 4. Set environment variables
export TURSO_URL="libsql://your-db-turso.io"
export TURSO_AUTH_TOKEN="your-token"

# 5. Run with Turso
npm run api
```

---

## 🌐 API Endpoints

### `GET /health`
Health check endpoint.

### `GET /api/stats`
Get database statistics.

```json
{
  "total_products": 78,
  "total_stores": 29,
  "products_updated_24h": 45
}
```

### `POST /api/find-alternatives`
Main endpoint. Find cheaper alternatives for a product.

**Request:**
```json
{
  "title": "CeraVe Moisturizing Cream 16oz",
  "price": 18.99,
  "store_domain": "target.com",
  "url": "https://target.com/...",
  "image_url": "https://..."
}
```

**Response:**
```json
{
  "query": {
    "title": "CeraVe Moisturizing Cream 16oz",
    "price": 18.99,
    "store": "target.com"
  },
  "match_type": "exact",
  "alternatives_count": 5,
  "alternatives": [
    {
      "title": "CeraVe Moisturizing Cream 16oz",
      "price": 16.99,
      "store": "amazon.com",
      "url": "https://...",
      "savings": "2.00"
    }
  ],
  "cheapest": { ... }
}
```

### `POST /api/report-products`
Bulk report products seen by users.

```json
{
  "products": [
    { "title": "...", "price": 19.99, "store_domain": "...", "url": "..." }
  ]
}
```

### `GET /api/search?q=cerave`
Search products in the database.

---

## 🕷️ Scraping Strategy

### Shopify Stores (Free)

Most Shopify stores expose their product catalog at `/products.json`:

```javascript
const response = await fetch('https://store.com/products.json?limit=250');
const { products } = await response.json();
```

### Expanding Your Index

1. **Affiliate Networks**: Join ShareASale, CJ, Rakuten for product feeds
2. **Google Shopping API**: Paid but comprehensive
3. **User Reports**: Every extension user contributes price data

### Rate Limiting

Be respectful:
- 500ms delay between requests to same domain
- 1s delay between different stores
- Handle 429 errors gracefully

---

## 🔌 Chrome Extension

### How It Works

1. **Content Script** (`content.js`) runs on every page
2. Detects if it's a product page (URL patterns, meta tags, structured data)
3. Extracts product info (title, price, image)
4. Calls your API to find alternatives
5. Shows overlay if cheaper options exist

### Product Detection

The extension detects products via:
- URL patterns (`/products/`, `/item/`, `/dp/`, etc.)
- Open Graph meta tags (`og:type="product"`)
- JSON-LD structured data (`@type: "Product"`)
- Price + title presence on page

### Customizing

To add support for a specific store, add selectors to `content.js`:

```javascript
const SELECTORS = {
    title: [
        '#your-store-title-selector',
        // ...
    ],
    price: [
        '.your-store-price-class',
        // ...
    ]
};
```

---

## 🚀 Deployment

### API Server

Deploy to any Node.js host:

**Vercel:**
```bash
npm i -g vercel
vercel
```

**Railway:**
```bash
npm i -g @railway/cli
railway up
```

**Fly.io:**
```bash
flyctl launch
flyctl deploy
```

### Extension

1. Create proper icons (16x16, 48x48, 128x128)
2. Update API_URL in `content.js`, `popup.js`, `background.js`
3. Zip the `extension` folder
4. Submit to Chrome Web Store

---

## 💰 Monetization

### Affiliate Links

Wrap outbound links with your affiliate ID:

```javascript
// In API response, replace URL with affiliate link
alternative.url = `https://yourtracker.com/go?url=${encodeURIComponent(alternative.url)}&aff=YOUR_ID`;
```

### Platform Fee

When you build the Shopify app for direct seller integration:
- Sellers pay 5% (vs 15-30% on Amazon)
- Handle payments via Stripe Connect

---

## 📊 Scaling

| Users | Database | Cost |
|-------|----------|------|
| 0-50K | Turso Free (9GB) | $0 |
| 50K-500K | Turso Pro ($29) + Vercel ($20) | ~$50/mo |
| 500K+ | Dedicated infrastructure | Varies |

---

## 🛣️ Roadmap

- [x] Core database schema
- [x] Shopify scraper
- [x] API server
- [x] Chrome extension
- [ ] Safari extension (iOS)
- [ ] Android app (AccessibilityService)
- [ ] Seller Shopify app
- [ ] Stripe Connect integration
- [ ] Affiliate network integrations

---

## 📝 License

MIT

---

## 🤝 Contributing

PRs welcome! Areas that need help:
- Store-specific extractors
- Additional data sources
- Mobile apps
- UI/UX improvements
