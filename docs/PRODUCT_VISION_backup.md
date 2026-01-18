📱 SPESPE - Complete Product Vision & Technical Architecture
Version: 1.0  
Last Updated: January 16, 2026  
Status: Ready for MVP Development
---
📑 Table of Contents
1. Executive Summary (#executive-summary) (30-second overview)
2. The Vision (#the-vision) (What we're building)
3. Current State (#current-state) (What we have now)
4. Technology Stack (#technology-stack) (What we'll use and why)
5. Architecture Overview (#architecture-overview) (How it all fits together)
6. Development Roadmap (#development-roadmap) (Phase-by-phase plan)
7. Cost Analysis (#cost-analysis) (Keeping it free)
8. Risk Assessment (#risk-assessment) (What could go wrong)
9. Immediate Next Steps (#immediate-next-steps) (Start today)
10. Reference Documentation (#reference-documentation) (For future you)
---
Executive Summary
What: Mobile-first web app to browse Italian supermarket deals, compare prices, and create shopping lists.
Who: You (primary user), then friends/family (10-50 users), potentially public (100-1,000 users).
Tech Stack: Next.js 14 + Supabase (PostgreSQL) + Vercel (hosting) - all with generous free tiers.
Timeline: 2-3 weeks to MVP, working incrementally.
Cost: $0/month for first year (free tiers cover everything).
Your Role: Frontend development (HTML/CSS/JS you know), learn minimal backend concepts.
---
The Vision
Problem Statement
You want to:
- See all supermarket deals in one place (currently checking multiple websites)
- Find the best price for specific items (milk, pasta, etc.)
- Create a shopping list optimized across stores
- Save time and money grocery shopping
Current Pain:
- Manual checking of Lidl/other flyers every week
- No easy way to compare prices across stores
- Can't remember which store had which deal
- Shopping lists scattered (notes app, paper, memory)
Solution: Spespe App
Core User Flow:
1. Open app on phone
   ↓
2. See this week's deals (all supermarkets)
   ↓
3. Search "broccoli" → see prices at Lidl, Conad, Esselunga
   ↓
4. Add to shopping list: "Broccoli €0.89 @ Lidl"
   ↓
5. Repeat for other items
   ↓
6. View shopping list organized by store
   ↓
7. Go shopping with optimized list!
Key Features (MVP)
Must Have (Week 1-2):
1. Browse deals (infinite scroll, mobile-optimized)
2. Search products (instant filter, case-insensitive)
3. Filter by supermarket (Lidl only at launch)
4. Sort by discount % or price
5. Add to shopping list (persistent, per-user)
6. View shopping list grouped by store
Nice to Have (Week 3-4):
1. Price history chart (see if €0.89 is actually a good deal)
2. Share shopping list (SMS/WhatsApp link)
3. Weekly deal alerts (email/push notification)
Future (Post-MVP):
1. Multiple supermarket support (Conad, Esselunga, etc.)
2. Recipe suggestions based on deals
3. Barcode scanner for in-store price check
4. Social features (share deals with friends)
---
Current State
What We Have (100% Complete ✅)
Scraper Pipeline:
- ✅ Browser automation (Playwright, 4K screenshots)
- ✅ AI vision extraction (Gemini 2.5 Flash via OpenRouter)
- ✅ Product parsing (11 fields: brand, price, discount, dates, notes, etc.)
- ✅ CSV export (UTF-8, Italian text preserved)
- ✅ GitHub Actions automation (weekly Monday 9am runs)
- ✅ Comprehensive testing (39 tests passing)
Data Quality:
- ✅ Extracts: product name, current price, old price, discount %
- ✅ Captures: weight/pack size, price per unit, offer dates
- ✅ Preserves: Italian text ("Coltivato in Italia", "confezione")
- ✅ Calculates: savings amount, confidence scores
Technical Infrastructure:
- ✅ Git repository with clean history
- ✅ Automated weekly execution
- ✅ Error handling and logging
- ✅ Artifact storage (screenshots, CSVs, logs)
What We Need (0% Complete ⏳)
Frontend:
- Web interface (mobile-first design)
- Product browsing UI
- Search functionality
- Shopping list management
Backend:
- Database to store products
- API to serve data to frontend
- User authentication (for shopping lists)
- CSV import pipeline (spotter → database)
Infrastructure:
- Hosting for frontend
- Database hosting
- Domain setup (spespe.it)
---
Technology Stack
The Recommended Stack (Opinionated!)
I'm recommending Next.js 14 + Supabase + Vercel because:
1. Matches your skills (HTML/CSS/basic JS)
2. All free tiers available
3. Simple deployment
4. Production-ready at scale
5. Huge community support
Stack Breakdown
1. Frontend: Next.js 14 (App Router)
What it is: React framework that makes web apps easy.
Why Next.js (not just React):
- ✅ Built-in routing (no complex setup)
- ✅ Server-side rendering (fast initial loads)
- ✅ Image optimization (automatic)
- ✅ Mobile-optimized by default
- ✅ TypeScript optional (start with JS)
- ✅ Huge ecosystem (libraries for everything)
What you'll write:
// This is what a Next.js page looks like
export default function DealsPage() {
  return (
    <div>
      <h1>This Week's Deals</h1>
      <ProductList />
    </div>
  )
}
Learning curve: Low (you know HTML/CSS, just sprinkle in JS)
Alternatives considered:
- ❌ Plain HTML/CSS/JS: Too much manual work, no mobile optimization
- ❌ Vue.js: Smaller ecosystem, harder to find help
- ❌ Svelte: Too new, less resources for beginners
- ❌ React Native: Mobile-only, can't use on desktop
Verdict: Next.js wins - best balance of power and simplicity.
---
2. Database: Supabase (PostgreSQL)
What it is: "Firebase but with a real database." Managed PostgreSQL with instant APIs.
Why Supabase (not other databases):
- ✅ Generous free tier (500MB database, 50,000 monthly active users)
- ✅ Instant REST API (no backend code needed!)
- ✅ Built-in authentication (shopping lists per user)
- ✅ Real-time subscriptions (future: live deal updates)
- ✅ PostgreSQL (real SQL, not limited NoSQL)
- ✅ Easy CSV import (for your spotter data)
- ✅ Dashboard UI (browse data like Excel)
What you'll do:
// This is ALL the code to fetch products
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('supermarket', 'Lidl')
  .order('discount_percent', { ascending: false })
No servers to manage. No complex queries. Just works.
Database Schema (Simple):
-- Table: products
id, supermarket, product_name, brand, current_price, old_price, 
discount_percent, weight_or_pack, price_per_unit, offer_start_date, 
offer_end_date, notes, extracted_at, confidence
-- Table: shopping_lists (future)
id, user_id, product_id, quantity, added_at
-- Table: users (managed by Supabase Auth)
id, email, created_at
Alternatives considered:
- ❌ Firebase: More expensive, limited querying, NoSQL complexity
- ❌ MongoDB Atlas: NoSQL not ideal for price comparisons
- ❌ PlanetScale: Complex for beginners, vitess quirks
- ❌ Railway PostgreSQL: Smaller free tier, more setup
- ❌ Self-hosted PostgreSQL: You said "ZERO backend knowledge" - this ain't it
Verdict: Supabase wins - PostgreSQL power with Firebase simplicity.
---
3. Hosting: Vercel
What it is: Deploy Next.js apps with one command. That's it.
Why Vercel:
- ✅ Made by Next.js creators (perfect integration)
- ✅ Free tier: Unlimited bandwidth, 100GB/month, custom domain
- ✅ Deploy = git push (literally just push to GitHub)
- ✅ Automatic HTTPS (SSL certificates included)
- ✅ Global CDN (fast worldwide)
- ✅ Preview deployments (test before going live)
- ✅ Zero configuration (it just works)
Deployment process:
# This is all you do:
git add .
git commit -m "Add new feature"
git push
# Vercel automatically:
# - Builds your app
# - Deploys to production
# - Updates spespe.it
# - Done in 30 seconds
Alternatives considered:
- ❌ Netlify: Good, but Vercel is better for Next.js
- ❌ GitHub Pages: Static only, no server-side features
- ❌ Heroku: Removed free tier
- ❌ Railway: Smaller free tier
- ❌ DigitalOcean: Requires server management (you don't want this)
Verdict: Vercel wins - made for Next.js, deploy = git push.
---
4. UI Framework: Shadcn/ui + Tailwind CSS
What it is: Pre-built beautiful components you copy/paste.
Why Shadcn:
- ✅ Copy/paste components (no package to install)
- ✅ Mobile-first responsive (works on phones automatically)
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Customizable (you own the code)
- ✅ Beautiful by default (no design skills needed)
- ✅ Tailwind CSS (utility classes you'll love)
Example:
// Search bar component (pre-built, just customize)
<Input 
  placeholder="Search products..." 
  onChange={(e) => setSearch(e.target.value)}
/>
Alternatives considered:
- ❌ Material UI: Heavy, slower, more complex
- ❌ Bootstrap: Outdated, not mobile-first
- ❌ Ant Design: Too enterprise-y
- ❌ Chakra UI: Good but smaller ecosystem
- ❌ Plain CSS: Too much work for mobile responsiveness
Verdict: Shadcn/ui wins - modern, beautiful, mobile-ready.
---
5. State Management: React Context (built-in)
What it is: Share data across components without prop drilling.
Why Context (not Redux/Zustand):
- ✅ Built into React (no new library)
- ✅ Simple for your use case
- ✅ Sufficient for shopping list state
- ✅ Easy to upgrade later if needed
When to upgrade: If app gets complex (100+ components), consider Zustand. Not needed for MVP.
---
6. CSV Import Pipeline: Supabase + GitHub Actions
What it is: Automated weekly data refresh.
Flow:
Monday 9am:
1. GitHub Actions runs spotter
2. Generates CSV (Lidl products)
3. Uploads CSV to Supabase storage
4. Supabase trigger imports CSV → database
5. Frontend automatically shows new deals
Why this approach:
- ✅ Fully automated (no manual work)
- ✅ No custom backend code needed
- ✅ Supabase storage is free
- ✅ Database Functions handle import (PostgreSQL magic)
---
Complete Stack Summary
| Layer | Technology | Free Tier | Why |
|-------|-----------|-----------|-----|
| Frontend | Next.js 14 | ∞ | Best React framework for your skills |
| UI Components | Shadcn/ui | ∞ | Beautiful, mobile-first, copy/paste |
| Styling | Tailwind CSS | ∞ | Utility-first, fast development |
| Database | Supabase (PostgreSQL) | 500MB | Instant APIs, auth, real-time |
| Hosting | Vercel | 100GB/mo | Made for Next.js, git push = deploy |
| Domain | Namecheap/Cloudflare | €10/year | Custom domain (spespe.it) |
| Scraper | Current setup | ∞ | Already working! |
| Total Monthly Cost | | €0 | Everything free! |
---
Architecture Overview
System Diagram
┌─────────────────────────────────────────────────────────────┐
│                    USER (Mobile Phone)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                 VERCEL (Frontend Hosting)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Next.js 14 App (spespe.it)                 │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ Browse     │  │  Search    │  │ Shopping   │     │   │
│  │  │ Deals Page │  │  Products  │  │ List Page  │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Supabase JS SDK
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE (Backend as a Service)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                 │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │  products   │  │ shopping_    │  │   users    │  │   │
│  │  │   table     │  │ lists table  │  │   (auth)   │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Storage (CSV files)                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auto-generated REST API                             │   │
│  │  GET /products?supermarket=eq.Lidl                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ CSV Upload
                         ↓
┌─────────────────────────────────────────────────────────────┐
│           GITHUB ACTIONS (Scraper Pipeline)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Monday 9am: Run Scraper                             │   │
│  │  1. Capture Lidl flyer (Playwright)                  │   │
│  │  2. Extract products (Gemini 2.5 Flash)              │   │
│  │  3. Generate CSV                                     │   │
│  │  4. Upload to Supabase Storage                       │   │
│  │  5. Trigger database import                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
Data Flow
Weekly Update Cycle:
Monday 9:00am (Europe/Rome):
├─ GitHub Actions triggers spotter
├─ Scraper runs (current working pipeline)
├─ CSV generated: lidl_products_20260116.csv
├─ CSV uploaded to Supabase Storage (bucket: flyer-data)
├─ Database function imports CSV into products table
└─ Frontend automatically shows new deals (queries updated data)
User visits app anytime:
├─ Frontend loads from Vercel CDN
├─ Queries Supabase for products
├─ Renders deals in mobile-optimized UI
└─ User adds items to shopping list (saved to Supabase)
---
Technology Stack (Detailed)
Frontend Deep Dive
Next.js 14 App Router
File Structure:
spespe-web/
├── app/
│   ├── page.js              # Home page (browse deals)
│   ├── search/
│   │   └── page.js          # Search results page
│   ├── list/
│   │   └── page.js          # Shopping list page
│   ├── layout.js            # Global layout (nav, footer)
│   └── api/
│       └── products/
│           └── route.js     # API endpoint (if needed)
├── components/
│   ├── ProductCard.jsx      # Single product display
│   ├── SearchBar.jsx        # Search input
│   ├── FilterButtons.jsx    # Supermarket filters
│   └── ShoppingList.jsx     # Shopping list component
├── lib/
│   └── supabase.js          # Supabase client setup
└── public/
    └── icons/               # Store logos, etc.
Why App Router (not Pages Router):
- Latest Next.js version
- Better performance
- Simpler data fetching
- Server components (faster loading)
Pages You'll Build:
1. Home Page (/) - Browse all deals
   - Infinite scroll list of products
   - Quick filters (Lidl, sort by discount)
   - Search bar at top
   - "Add to list" button on each product
2. Search Page (/search) - Dynamic search results
   - Same as home but filtered by query
   - URL: /search?q=broccoli
3. Shopping List (/list) - Your shopping list
   - Grouped by supermarket
   - Total price calculation
   - Share button
   - Clear all button
4. Product Detail (/product/[id]) (Optional MVP)
   - Price history chart
   - Similar products
   - Store location info
---
UI Components (Shadcn/ui)
Components You'll Need:
| Component | Purpose | Shadcn Component |
|-----------|---------|------------------|
| Product cards | Display deals | Card, Badge |
| Search bar | Filter products | Input, Command |
| Filters | Supermarket selection | ToggleGroup, Select |
| Shopping list | Manage list | Checkbox, Button, ScrollArea |
| Navigation | Mobile nav | Sheet (slide-out menu) |
| Sort controls | Price/discount sort | DropdownMenu |
| Empty states | No results | Custom (with icons) |
| Loading states | Fetching data | Skeleton |
Installation:
# Init Shadcn
npx shadcn-ui@latest init
# Add components as you need them
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add button
# etc.
Mobile-First Design Principles:
- Touch targets: minimum 44×44px (Apple HIG)
- Font size: minimum 16px (no zoom on input)
- Contrast: WCAG AA compliant
- Scrolling: momentum scrolling, no janky animations
- Loading: skeleton screens (not spinners)
---
Tailwind CSS
What you'll write:
// Old way (CSS files)
<div className="product-card">
  <h3 className="product-name">Broccoli</h3>
</div>
// New way (Tailwind)
<div className="bg-white rounded-lg shadow p-4">
  <h3 className="text-lg font-semibold">Broccoli</h3>
</div>
Why it's better:
- No separate CSS files
- Mobile-responsive utilities (md:, lg:)
- Dark mode built-in (dark:)
- Consistent spacing/colors
- Fast development
Learning Curve:
- Day 1: Copy/paste examples, looks good
- Week 1: Understand utilities, modify confidently
- Month 1: Building custom designs from scratch
---
Backend Deep Dive
Supabase Setup
What Happens:
1. Create Supabase project (2 minutes, web UI)
2. Get database URL and API key
3. Create tables (SQL or UI dashboard)
4. Connect from Next.js (2 lines of code)
5. Done!
Database Tables:
products table:
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  
  -- Supermarket info
  supermarket TEXT NOT NULL,
  retailer TEXT,
  
  -- Product details
  product_name TEXT NOT NULL,
  brand TEXT,
  description TEXT,
  
  -- Pricing
  current_price DECIMAL(10,2) NOT NULL,
  old_price DECIMAL(10,2),
  discount_percent TEXT,
  saving_amount DECIMAL(10,2),
  saving_type TEXT,
  
  -- Measurements
  weight_or_pack TEXT,
  price_per_unit TEXT,
  
  -- Dates
  offer_start_date TEXT,
  offer_end_date TEXT,
  global_validity_start TEXT,
  global_validity_end TEXT,
  
  -- Metadata
  confidence DECIMAL(3,2),
  notes TEXT[],
  extracted_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for fast queries
  CONSTRAINT products_name_key UNIQUE (product_name, supermarket, extracted_at)
);
-- Indexes for performance
CREATE INDEX idx_products_supermarket ON products(supermarket);
CREATE INDEX idx_products_price ON products(current_price);
CREATE INDEX idx_products_discount ON products(discount_percent);
CREATE INDEX idx_products_dates ON products(offer_start_date, offer_end_date);
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('italian', product_name));
shopping_lists table (Phase 2):
CREATE TABLE shopping_lists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  product_id BIGINT REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  added_at TIMESTAMP DEFAULT NOW(),
  checked BOOLEAN DEFAULT FALSE
);
CSV Import Function (PostgreSQL):
-- This runs automatically when CSV is uploaded
CREATE OR REPLACE FUNCTION import_csv_to_products()
RETURNS TRIGGER AS $$
BEGIN
  -- Read CSV from storage
  -- Parse and insert into products table
  -- Log success/failure
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
Supabase API Examples:
// Get all Lidl products sorted by discount
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('supermarket', 'Lidl')
  .order('discount_percent', { ascending: false })
  .limit(50)
// Search products
const { data } = await supabase
  .from('products')
  .select('*')
  .textSearch('product_name', 'broccoli')
// Get user's shopping list
const { data } = await supabase
  .from('shopping_lists')
  .select('*, products(*)')
  .eq('user_id', userId)
// Add to shopping list
await supabase
  .from('shopping_lists')
  .insert({ user_id: userId, product_id: productId, quantity: 1 })
No backend code needed. Supabase generates these APIs automatically.
---
PWA vs Native App Decision
Recommendation: Start with PWA, native app later if needed.
PWA (Progressive Web App):
Pros:
- ✅ Works on iOS and Android (one codebase)
- ✅ Installable (add to home screen)
- ✅ Offline support (service workers)
- ✅ Push notifications (with user permission)
- ✅ No App Store approval needed
- ✅ Instant updates (no app store delays)
- ✅ 100% web technologies (HTML/CSS/JS)
Cons:
- ❌ iOS limitations (no background sync)
- ❌ Slightly less "native" feel
- ❌ Can't access some device features (NFC, full Bluetooth, etc.)
Native App (React Native):
Pros:
- ✅ Full device API access
- ✅ Smoother animations
- ✅ App Store presence (discoverability)
- ✅ Better offline capabilities
Cons:
- ❌ Need separate iOS/Android builds
- ❌ App Store approval (weeks of waiting)
- ❌ 30% Apple tax on in-app purchases
- ❌ More complex development
- ❌ Deployment delays (app review process)
Decision Matrix:
| Need | PWA | Native | Winner |
|------|-----|--------|--------|
| Quick launch | ✅ Yes | ❌ No | PWA |
| Free hosting | ✅ Yes | ⚠️ Partial | PWA |
| Works on all devices | ✅ Yes | ❌ No | PWA |
| Easy updates | ✅ Instant | ❌ Slow | PWA |
| Your skill level | ✅ Perfect | ❌ New tech | PWA |
| Offline shopping list | ✅ Yes | ✅ Yes | Tie |
| Push notifications | ⚠️ Limited | ✅ Full | Native |
| Device features | ❌ Limited | ✅ Full | Native |
Verdict: PWA for MVP, consider native app if you hit 1,000+ users.
PWA Implementation (Next.js):
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public'
})
module.exports = withPWA({
  // Your Next.js config
})
// That's it! PWA enabled.
---
Development Roadmap
Phase 1: Foundation (Week 1) - 20 hours
Goal: Basic app showing products from database
Tasks:
1. Setup (2 hours)
   - Create Next.js project (npx create-next-app spespe-web)
   - Install Shadcn/ui (npx shadcn-ui init)
   - Create Supabase project
   - Connect Next.js to Supabase
2. Database (3 hours)
   - Create products table in Supabase
   - Import one CSV manually (test data)
   - Verify queries work
3. Home Page (8 hours)
   - Create product card component
   - Fetch products from Supabase
   - Display in grid/list layout
   - Mobile-responsive design
   - Basic loading states
4. Search (4 hours)
   - Add search bar component
   - Implement client-side filtering (simple)
   - Later upgrade to database search
5. Deploy (3 hours)
   - Connect GitHub to Vercel
   - Deploy to production
   - Test on mobile phone
   - Fix any mobile issues
Deliverable: Live app at spespe.vercel.app showing Lidl products.
Success Criteria:
- ✅ Can browse products on phone
- ✅ Can search for "broccoli"
- ✅ Loads in < 2 seconds
- ✅ Works on your phone
---
Phase 2: Shopping List (Week 2) - 15 hours
Goal: Add/manage shopping list
Tasks:
1. Authentication (4 hours)
   - Enable Supabase Auth (email/password)
   - Add login page
   - Protected routes for shopping list
   - Session management
2. Shopping List UI (6 hours)
   - Create shopping list page
   - Add "Add to list" button on products
   - Shopping list component (checkboxes, quantities)
   - Group by supermarket
   - Total price calculation
3. Database (2 hours)
   - Create shopping_lists table
   - Add database functions
   - Test CRUD operations
4. Persistence (3 hours)
   - Save list to Supabase
   - Load list on page refresh
   - Sync across devices (same account)
   - Offline support (localStorage fallback)
Deliverable: Working shopping list with persistence.
Success Criteria:
- ✅ Can add products to list
- ✅ List persists after closing app
- ✅ Can check off items
- ✅ Shows total price
---
Phase 3: Polish & Features (Week 3) - 12 hours
Goal: Production-ready MVP
Tasks:
1. UI Polish (4 hours)
   - Improve mobile design (spacing, touch targets)
   - Add empty states ("No products found")
   - Better loading skeletons
   - Error handling (network issues)
2. Performance (3 hours)
   - Add pagination/infinite scroll (load 50 products at a time)
   - Image optimization (if using product images)
   - Lazy loading components
   - Reduce initial bundle size
3. PWA Features (3 hours)
   - Add manifest.json (installability)
   - Service worker (offline support)
   - "Add to home screen" prompt
   - Offline shopping list (read-only)
4. Filters & Sorting (2 hours)
   - Supermarket filter (Lidl vs All)
   - Sort by: Discount %, Price (low→high), Name (A→Z)
   - Active filters UI
Deliverable: Polished MVP ready for real use.
Success Criteria:
- ✅ Works offline (shopping list)
- ✅ Installable on phone
- ✅ Fast (<2s load, <100ms interactions)
- ✅ Feels like a native app
---
Phase 4: Automation (Week 4) - 8 hours
Goal: Fully automated weekly updates
Tasks:
1. CSV Upload Automation (4 hours)
   - Modify GitHub Actions to upload CSV to Supabase
   - Create Supabase Storage bucket
   - Set up access permissions
2. Database Import Function (3 hours)
   - Write PostgreSQL function to import CSV
   - Create trigger on file upload
   - Handle duplicates (upsert logic)
   - Log import results
3. Testing & Monitoring (1 hour)
   - Test full end-to-end flow
   - Set up Supabase monitoring
   - Email notifications on spotter failure
Deliverable: Fully automated pipeline (spotter → database → frontend).
Success Criteria:
- ✅ Monday spotter automatically updates database
- ✅ Frontend shows new deals without manual intervention
- ✅ Old data archived (price history)
- ✅ No manual CSV uploads needed
---
Phase 5: Launch (Week 5) - 4 hours
Goal: Public launch
Tasks:
1. Domain Setup (1 hour)
   - Buy spespe.it (Namecheap ~€10/year)
   - Configure DNS → Vercel
   - HTTPS auto-enabled
2. Final Testing (2 hours)
   - Test on multiple devices (iOS, Android)
   - Test on slow network (3G simulation)
   - Fix any last bugs
3. Soft Launch (1 hour)
   - Share with 3-5 friends/family
   - Collect feedback
   - Monitor usage
Deliverable: Live at spespe.it, ready for users.
---
Cost Analysis
Free Tier Limits (First Year)
| Service | Free Tier | Your Usage | Safe? |
|---------|-----------|------------|-------|
| Vercel | 100GB bandwidth/mo | ~1GB/mo (50 users) | ✅ Yes |
| Supabase | 500MB database | ~50MB (20k products) | ✅ Yes |
| Supabase | 50k MAU | 10-50 users | ✅ Yes |
| Supabase | 1GB storage | ~10MB CSVs | ✅ Yes |
| GitHub | Unlimited repos | 1 private repo | ✅ Yes |
| GitHub Actions | 2,000 min/mo | ~100 min/mo | ✅ Yes |
| OpenRouter | Free tier | Gemini = free | ✅ Yes |
| Domain | N/A | €10/year | 💰 Only cost |
Total Monthly Cost: €0  
Total Yearly Cost: €10 (domain only)
When You'll Need to Pay
Supabase ($25/month when you exceed):
- 500MB database (≈100,000 products with history)
- 50k monthly active users
- 1GB file storage
Realistic timeline: Year 2-3 if app gets popular
Vercel ($20/month when you exceed):
- 100GB bandwidth (≈50,000 page views/month)
- Commercial use (if you monetize)
Realistic timeline: Year 2 if app goes viral
Your Runway: 12-18 months completely free (assuming moderate growth).
---
Risk Assessment
Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scraper breaks | Medium | High | Monitor weekly, fix promptly. Keep logs. |
| Gemini API changes | Low | High | OpenRouter abstracts this, easy to switch models. |
| Supabase data loss | Very Low | Critical | Supabase has backups, export CSVs weekly. |
| Vercel deployment fails | Low | Medium | Preview deployments catch issues before production. |
| Mobile browser incompatibility | Medium | Medium | Test on iOS Safari and Chrome Android early. |
| Italian special characters break | Low | Low | Already handling UTF-8 correctly. |
| Database fills up | Low | Low | Monitor usage, delete old data if needed. |
| Performance degrades | Medium | Medium | Add pagination early, optimize queries. |
Product Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users don't find it useful | Medium | High | Launch quickly, get feedback, iterate. |
| Too complex for casual users | Low | Medium | Keep UI simple, progressive disclosure. |
| Not mobile-friendly enough | Medium | High | Mobile-first design from day 1, test on real devices. |
| Data becomes stale | Low | Medium | Automated weekly updates, show "last updated" date. |
| Privacy concerns | Low | Medium | No personal data collection, clear privacy policy. |
Business Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supermarkets block scraping | Low | High | Respectful scraping (once/week), user-agent transparency. |
| Legal issues with price data | Low | Medium | EU price transparency laws favor consumers. Research Italian regulations. |
| Can't monetize later | Medium | Low | Doesn't matter for MVP, many options (ads, premium features). |
---
Common Pitfalls & How to Avoid Them
Pitfall 1: Over-Engineering Database
Mistake: Creating 10 tables with complex relationships before you have users.
Reality: Start with 1-2 tables. Add more when you NEED them.
Your Approach:
- Phase 1: Just products table
- Phase 2: Add shopping_lists when feature is ready
- Phase 3+: Add more as features demand
---
Pitfall 2: Perfect UI Before Launch
Mistake: Spending 3 months making it "pixel perfect" before anyone uses it.
Reality: Users care about functionality > aesthetics.
Your Approach:
- Week 1: Ugly but functional
- Week 2: Clean up based on your usage
- Week 3: Polish based on friend feedback
- Week 4+: Iterate based on real usage
---
Pitfall 3: Complex Authentication
Mistake: Building custom auth with password reset, 2FA, OAuth, etc.
Reality: Supabase Auth handles all this. Use it.
Your Approach:
- Phase 1: No auth (single user = you)
- Phase 2: Email/password only (Supabase built-in)
- Phase 3+: Add social login if users request it
---
Pitfall 4: Not Testing on Real Devices
Mistake: Developing only on desktop Chrome, then wondering why it's broken on iPhone.
Reality: Mobile Safari behaves differently. Android Chrome too.
Your Approach:
- Test on your actual phone from day 1
- Use Chrome DevTools mobile emulation
- Ask friends to test (different devices)
---
Pitfall 5: Ignoring Performance
Mistake: Loading 10,000 products at once, app becomes sluggish.
Reality: Mobile phones have limited memory.
Your Approach:
- Pagination (load 50 products at a time)
- Virtual scrolling (only render visible items)
- Lazy loading (load images as you scroll)
- Lighthouse score > 90 (Google's performance tool)
---
Pitfall 6: Not Handling Errors
Mistake: Assuming API calls always succeed.
Reality: Networks fail. Databases timeout. Shit happens.
Your Approach:
// Bad
const products = await supabase.from('products').select('*')
// Good
const { data: products, error } = await supabase.from('products').select('*')
if (error) {
  console.error('Failed to load products:', error)
  showErrorToast('Could not load products. Please try again.')
  return
}
---
Immediate Next Steps (Start Today!)
Step 1: Setup Next.js Project (30 minutes)
# Create new Next.js app
npx create-next-app@latest spespe-web
# Choose: App Router, Tailwind CSS, TypeScript (optional)
cd spespe-web
# Install Shadcn
npx shadcn-ui@latest init
# Choose defaults
# Install Supabase client
npm install @supabase/supabase-js
# Run dev server
npm run dev
# Visit http://localhost:3000
Deliverable: "Hello World" Next.js app running locally.
---
Step 2: Setup Supabase (20 minutes)
1. Go to supabase.com
2. Sign up with GitHub account
3. Create new project: "spespe-production"
4. Region: EU (Frankfurt or Ireland - closest to Italy)
5. Wait 2 minutes for provisioning
6. Copy API keys from Settings → API
Deliverable: Supabase project ready, API keys copied.
---
Step 3: Connect Next.js to Supabase (15 minutes)
Create: lib/supabase.js
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)
Create: .env.local
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
Test connection:
// app/page.js
import { supabase } from '@/lib/supabase'
export default async function Home() {
  const { data, error } = await supabase.from('products').select('*')
  
  return (
    <div>
      <h1>Spespe</h1>
      <p>Connected to Supabase: {error ? 'No' : 'Yes'}</p>
    </div>
  )
}
Deliverable: Next.js app connected to Supabase.
---
Step 4: Create Products Table (10 minutes)
In Supabase Dashboard → SQL Editor:
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  supermarket TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  current_price DECIMAL(10,2) NOT NULL,
  old_price DECIMAL(10,2),
  discount_percent TEXT,
  weight_or_pack TEXT,
  price_per_unit TEXT,
  offer_start_date TEXT,
  offer_end_date TEXT,
  notes TEXT[],
  confidence DECIMAL(3,2),
  extracted_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_products_supermarket ON products(supermarket);
CREATE INDEX idx_products_name ON products(product_name);
Run the SQL.
Deliverable: products table created and ready.
---
Step 5: Import Test Data (15 minutes)
Option A: Manual CSV Import (Supabase UI)
1. Go to Table Editor → products
2. Click "Insert" → "Import data from CSV"
3. Upload your latest lidl_products_TIMESTAMP.csv
4. Map columns
5. Import
Option B: SQL Insert (for testing)
INSERT INTO products (supermarket, product_name, current_price, old_price, discount_percent, weight_or_pack)
VALUES 
  ('Lidl', 'Broccoli', 0.89, 1.29, '-31%', '500 g confezione'),
  ('Lidl', 'Filetto di petto di pollo', 4.99, 6.99, '-28%', '650 g confezione'),
  ('Lidl', 'Porchetta affettata', 1.59, 2.39, '-33%', '120 g confezione');
Verify:
SELECT * FROM products LIMIT 10;
Deliverable: Database populated with test products.
---
Step 6: Build First Product Card (1 hour)
Create: components/ProductCard.jsx
export default function ProductCard({ product }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition">
      {/* Discount badge */}
      {product.discount_percent && (
        <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-bold">
          {product.discount_percent}
        </span>
      )}
      
      {/* Product name */}
      <h3 className="text-lg font-semibold mt-2">{product.product_name}</h3>
      
      {/* Brand */}
      {product.brand && (
        <p className="text-sm text-gray-600">{product.brand}</p>
      )}
      
      {/* Prices */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-2xl font-bold text-green-600">
          €{product.current_price}
        </span>
        {product.old_price && (
          <span className="text-sm text-gray-400 line-through">
            €{product.old_price}
          </span>
        )}
      </div>
      
      {/* Weight */}
      {product.weight_or_pack && (
        <p className="text-sm text-gray-600 mt-1">{product.weight_or_pack}</p>
      )}
      
      {/* Add to list button */}
      <button className="w-full mt-3 bg-blue-500 text-white rounded py-2 hover:bg-blue-600">
        Add to Shopping List
      </button>
    </div>
  )
}
Use in page:
// app/page.js
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'
export default async function Home() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('discount_percent', { ascending: false })
    .limit(50)
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">This Week's Deals</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
Deliverable: Homepage showing product cards.
---
Step 7: Deploy to Vercel (20 minutes)
1. Connect GitHub:
   - Push spespe-web to GitHub
   - Go to vercel.com
   - "Import Project" → select spespe-web repo
2. Configure:
   - Framework: Next.js (auto-detected)
   - Environment Variables:
     - NEXT_PUBLIC_SUPABASE_URL
     - NEXT_PUBLIC_SUPABASE_ANON_KEY
3. Deploy:
   - Click "Deploy"
   - Wait 1-2 minutes
   - App live at spespe-web.vercel.app
4. Test:
   - Open on your phone
   - Check products load
   - Verify mobile layout
Deliverable: Live app accessible from anywhere.
---
Reference Documentation
Current Codebase (Scraper)
Location: https://github.com/giarox/spespe
Key Files:
- src/vision.py - Gemini 2.5 Flash extraction
- src/browser.py - Playwright screenshot capture
- src/extractor.py - Product structuring
- src/csv_export.py - CSV generation
- .github/workflows/spotter.yml - Automated execution
How It Works:
1. Monday 9am: GitHub Actions triggers
2. Playwright captures Lidl flyer screenshot (4K)
3. Gemini 2.5 Flash extracts products via OpenRouter
4. Parser structures data (11 fields)
5. Exports to CSV with Italian text
6. Uploads artifacts to GitHub
Data Output (CSV Columns):
supermarket, product_name, brand, current_price, old_price, 
discount_percent, saving_amount, weight_or_pack, price_per_unit,
offer_start_date, offer_end_date, notes, confidence, extracted_at
---
Future Codebase (Web App)
Location: TBD - Will create spespe-web repository
Structure:
spespe-web/
├── app/                    # Next.js 14 App Router
│   ├── page.js            # Home (browse deals)
│   ├── search/page.js     # Search results
│   ├── list/page.js       # Shopping list
│   └── layout.js          # Global layout
├── components/             # Reusable UI
│   ├── ProductCard.jsx    # Product display
│   ├── SearchBar.jsx      # Search input
│   ├── ShoppingList.jsx   # List management
│   └── ui/                # Shadcn components
├── lib/
│   ├── supabase.js        # Database client
│   └── utils.js           # Helper functions
├── public/                # Static assets
└── styles/                # Global CSS
---
Environment Variables Needed
Development (.env.local):
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
Production (Vercel dashboard):
- Same as development
- Vercel encrypts them automatically
---
Database Schema Reference
Current (MVP):
products (
  id BIGSERIAL PRIMARY KEY,
  supermarket TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  current_price DECIMAL NOT NULL,
  old_price DECIMAL,
  discount_percent TEXT,
  weight_or_pack TEXT,
  price_per_unit TEXT,
  offer_start_date TEXT,
  offer_end_date TEXT,
  notes TEXT[],
  confidence DECIMAL,
  extracted_at TIMESTAMP DEFAULT NOW()
)
Future (Phase 2+):
shopping_lists (
  id BIGSERIAL,
  user_id UUID,
  product_id BIGINT,
  quantity INTEGER,
  added_at TIMESTAMP,
  checked BOOLEAN
)
price_history (
  id BIGSERIAL,
  product_name TEXT,
  supermarket TEXT,
  price DECIMAL,
  recorded_at TIMESTAMP
)
---
API Endpoints (Auto-Generated by Supabase)
Base URL: https://yourproject.supabase.co/rest/v1/
Common Queries:
// Get all products
GET /products?select=*
// Filter by supermarket
GET /products?supermarket=eq.Lidl
// Search by name
GET /products?product_name=ilike.*broccoli*
// Sort by discount
GET /products?order=discount_percent.desc
// Limit results
GET /products?limit=50&offset=0
You don't build these endpoints. Supabase generates them automatically from your tables.
---
Decision Log (For Future Reference)
Technology Choices
| Decision | What We Chose | Alternatives Considered | Why We Chose This |
|----------|--------------|------------------------|-------------------|
| Vision Model | Gemini 2.5 Flash | Molmo, Mistral, Grok, other Gemini variants | Comprehensive benchmarking showed best accuracy + field completeness |
| Frontend Framework | Next.js 14 | React, Vue, Svelte, plain HTML | Best balance of power/simplicity, matches your skills, huge ecosystem |
| Database | Supabase (PostgreSQL) | Firebase, MongoDB, PlanetScale, self-hosted | Instant APIs, real SQL, generous free tier, no backend code needed |
| Hosting | Vercel | Netlify, Heroku, Railway, DigitalOcean | Made for Next.js, git push = deploy, free SSL/CDN |
| UI Framework | Shadcn/ui + Tailwind | Material UI, Bootstrap, Chakra | Modern, mobile-first, copy/paste components, beautiful defaults |
| App Type | PWA (web app) | React Native, Flutter, native Swift/Kotlin | Faster to market, works everywhere, no app store hassles |
| Deployment Model | Serverless | Traditional server (VPS, containers) | Zero server management, scales automatically, free tier generous |
Architectural Patterns
| Pattern | Chosen Approach | Why |
|---------|----------------|-----|
| Data Fetching | Server Components (Next.js 14) | Faster page loads, SEO benefits, simpler code |
| State Management | React Context (built-in) | Sufficient for MVP, no new library to learn |
| Authentication | Supabase Auth | Pre-built, secure, handles sessions/tokens |
| File Storage | Supabase Storage | Free 1GB, integrates with database triggers |
| API Layer | Supabase Auto-API | No backend code needed, instant REST/GraphQL |
| Styling | Tailwind utility classes | Fast development, mobile-responsive, no CSS files |
| Form Handling | React Hook Form | Lightweight, easy validation, works with Tailwind |
---
Development Philosophy
Principles to Follow
1. Ship Fast, Iterate Faster
   - MVP in 2 weeks > Perfect app in 6 months
   - Get it in your hands quickly
   - Learn from real usage
2. Mobile-First Always
   - Design for phone first
   - Desktop is a bonus
   - Touch targets, thumb zones, scrolling
3. Data is King
   - Scraper quality matters most
   - UI can always improve
   - Bad data = useless app
4. Free Until Proven
   - Don't pay for anything until you NEED it
   - Free tiers are generous
   - Revenue before costs
5. Simple > Clever
   - Boring code that works > Fancy code that breaks
   - Copy/paste > Reinvent
   - Learn incrementally
---
Questions & Answers
Q: What if Supabase free tier fills up?
A: Unlikely for year 1. But if it does:
1. Delete old data (keep last 4 weeks only)
2. Optimize table (remove unused fields)
3. Upgrade to $25/month (still cheap)
4. Archive historical data to CSV
Q: Can I add other supermarkets later?
A: Yes! Easy:
1. Create new spotter for Conad/Esselunga (copy Lidl spotter)
2. Run weekly alongside Lidl spotter
3. Import CSV to same products table (just different supermarket value)
4. Frontend automatically shows all stores
Q: What if I want iOS/Android apps later?
A: Two paths:
1. PWA → Native wrapper: Use Capacitor to wrap PWA (easier)
2. Rebuild in React Native: Rewrite (more work, better UX)
Recommendation: Capacitor if PWA works well.
Q: How do I handle multiple users?
A: Supabase Auth:
// Sign up
await supabase.auth.signUp({ email, password })
// Sign in
await supabase.auth.signInWithPassword({ email, password })
// Get current user
const { data: { user } } = await supabase.auth.getUser()
// Shopping lists are automatically filtered by user_id
That's it. Supabase handles sessions, tokens, security.
Q: What if spotter breaks?
A: Monitoring + Quick Fix:
1. GitHub Actions emails you on failure
2. Check logs in artifacts
3. Fix spotter (usually minor changes to selectors)
4. Re-run workflow manually
5. Normal users see cached data (still useful)
Q: How do I debug issues?
A: Debugging Tools:
- Frontend: Chrome DevTools, React DevTools
- Database: Supabase dashboard (browse data like Excel)
- Scraper: GitHub Actions logs (detailed step-by-step)
- Network: Browser Network tab (see API calls)
- Mobile: Safari/Chrome remote debugging
---
File Structure After Completion
spespe/ (monorepo)
├── spotter/                 # Current spotter code (move here)
│   ├── src/
│   │   ├── vision.py
│   │   ├── browser.py
│   │   ├── extractor.py
│   │   └── csv_export.py
│   ├── tests/
│   ├── .github/workflows/
│   └── README.md
│
├── web/                     # New web app
│   ├── app/
│   │   ├── page.js         # Home
│   │   ├── search/
│   │   ├── list/
│   │   └── layout.js
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json
│
├── docs/                    # Documentation
│   ├── PRODUCT_VISION.md   # This document
│   ├── DEVELOPMENT_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── benchmark_archive/  # Historical data
│
└── README.md               # Project overview
Or keep separate:
- spespe - Scraper only
- spespe-web - Web app only
Recommendation: Separate repos (easier to manage, separate deploy cycles).
---
Documentation Cleanup Plan
Files to Create
1. README.md (Project Root)
   - What is Spespe
   - Current status (spotter ✅, web app ⏳)
   - Quick start guides
   - Link to detailed docs
2. docs/SCRAPER.md
   - How the spotter works
   - Vision model selection (why Gemini)
   - CSV output format
   - Troubleshooting guide
3. docs/PRODUCT_VISION.md
   - This document (saved)
   - Technology choices
   - Development roadmap
   - Decision log
4. docs/WEB_APP_GUIDE.md (After Phase 1)
   - Setup instructions
   - Component documentation
   - Supabase schema
   - Deployment guide
Files to Update
1. Current README.md
   - Add "What's Next" section
   - Link to product vision
   - Explain two-part system (spotter + web)
2. docs/benchmark_archive/WINNER.md
   - Keep as-is (historical reference)
Files to Delete
- Any old TODO files
- Temporary test files
- Duplicate documentation
---
Success Metrics
Week 1 (Foundation)
- [ ] Next.js app deployed to Vercel
- [ ] Products loading from Supabase
- [ ] Mobile responsive
- [ ] You can browse deals on your phone
Week 2 (Shopping List)
- [ ] Can add products to list
- [ ] List persists across sessions
- [ ] List grouped by supermarket
- [ ] Total price calculation
Week 3 (Polish)
- [ ] PWA installable
- [ ] Works offline (shopping list)
- [ ] Fast (<2s load)
- [ ] Friends using it successfully
Week 4 (Automation)
- [ ] Scraper automatically updates database
- [ ] No manual CSV imports
- [ ] End-to-end automation working
- [ ] Ready for public launch
---
What to Expect (Reality Check)
Week 1 Reality
- Day 1-2: Lots of setup, tutorials, confusion
- Day 3-4: "Aha!" moments, things clicking
- Day 5-7: First working version, feels amazing
You'll Feel:
- Overwhelmed (normal)
- Excited when something works
- Frustrated when it doesn't
- Accomplished by end of week
Week 2 Reality
- Challenges: Authentication, state management
- Breakthroughs: Shopping list working
- Lessons: Database queries, React hooks
Week 3 Reality
- Challenges: Mobile quirks (iOS Safari is weird)
- Breakthroughs: PWA installable, feels native
- Lessons: Performance optimization, caching
Week 4 Reality
- Challenges: Automation debugging
- Breakthroughs: Full pipeline automated
- Lessons: PostgreSQL functions, GitHub Actions secrets
---
Emergency Contacts (When You're Stuck)
Learning Resources
Next.js:
- Official Docs: https://nextjs.org/docs
- Tutorial: https://nextjs.org/learn (interactive, excellent)
- YouTube: Fireship "Next.js in 100 seconds"
Supabase:
- Official Docs: https://supabase.com/docs
- Tutorial: "Build a Twitter Clone" (covers all features)
- YouTube: "Supabase Crash Course"
Tailwind:
- Docs: https://tailwindcss.com/docs
- Cheat Sheet: https://tailwindcomponents.com
- YouTube: "Tailwind CSS Tutorial"
Shadcn/ui:
- Docs: https://ui.shadcn.com
- Examples: Browse components, copy code
- Templates: Pre-built page layouts
Communities (When Stuck)
1. Supabase Discord - Fastest help, very friendly
2. Next.js GitHub Discussions - Official support
3. Stack Overflow - Search first, ask second
4. Reddit r/nextjs - Community help
"I'm Stuck" Flowchart
Issue?
├─ Frontend not loading?
│  └─ Check console errors (F12)
│     └─ Google the error message
│
├─ Database query not working?
│  └─ Test in Supabase SQL Editor
│     └─ Simplify query, add fields back gradually
│
├─ Mobile looks broken?
│  └─ Chrome DevTools → Toggle device toolbar
│     └─ Test on actual phone (simulator lies)
│
├─ Deployment failed?
│  └─ Check Vercel build logs
│     └─ Usually env variables missing
│
└─ Everything is broken?
   └─ Restart dev server (npm run dev)
      └─ Clear browser cache
         └─ Still broken? Ask AI/Discord
---
Success Checklist (Copy This!)
Before Starting Development
- [ ] Read this entire document
- [ ] Understand the big picture
- [ ] Accept that Week 1 will be messy
- [ ] Block 2-3 hours for initial setup
Phase 1 Complete When
- [ ] Can visit app on phone
- [ ] Products display correctly
- [ ] Mobile layout looks good
- [ ] Search works (basic)
- [ ] Deployed to Vercel
MVP Complete When
- [ ] Shopping list works
- [ ] Persists across sessions
- [ ] PWA installable
- [ ] Automated weekly updates
- [ ] 3 friends using it successfully
Ready for Scale When
- [ ] 50+ weekly active users
- [ ] No bugs reported
- [ ] Performance is good (<2s load)
- [ ] Automated monitoring in place
---
Final Recommendations
What to Build First (This Weekend)
Saturday (4 hours):
1. Setup Next.js + Supabase (1 hour)
2. Create products table (30 min)
3. Import test CSV (30 min)
4. Build product card component (1 hour)
5. Display products on homepage (1 hour)
Sunday (4 hours):
1. Add search bar (1 hour)
2. Add filter buttons (1 hour)
3. Mobile layout polish (1 hour)
4. Deploy to Vercel (1 hour)
Monday (1 hour):
- Show friends
- Get feedback
- Celebrate! 🎉
What NOT to Build Yet
❌ User accounts (you're the only user for now)  
❌ Multiple supermarkets (just Lidl for MVP)  
❌ Price history (need data first)  
❌ Push notifications (PWA limitation anyway)  
❌ Social features (premature)  
❌ Admin dashboard (Supabase UI is enough)  
The Golden Rule
"If it doesn't help you make a shopping list faster, don't build it yet."
---
Your Personal Commitment
To keep this project on track:
1. Code for 2 hours minimum, 3× per week (Saturday, Sunday, one weeknight)
2. Ship something every weekend (even if tiny)
3. Use it yourself (dogfood your own app)
4. Get feedback from 1 friend per week
5. Don't disappear for 3+ weeks (momentum matters)
---
When You Come Back to This Document
If you're reading this after a break:
1. Where are we? Check GitHub (last commit date)
2. What was I building? Read "Current State" section
3. What's next? Check "Development Roadmap" section
4. How do I run it? Check "Immediate Next Steps"
5. Why did I choose X? Check "Decision Log"
If you're handing this off:
1. To another developer: Read sections 1, 3, 4, 5, 10
2. To a designer: Read sections 2, 6 (UI mockups)
3. To an investor: Read sections 1, 2, 7 (cost analysis)
---
🎯 TL;DR (30-Second Skim)
What: Mobile app to browse Italian supermarket deals and create shopping lists.
Tech: Next.js (frontend) + Supabase (database) + Vercel (hosting) = All free.
Status Now: Scraper 100% done, web app 0% done.
Next 3 Steps:
1. Setup Next.js + Supabase (Saturday, 2 hours)
2. Build product browsing UI (Sunday, 4 hours)  
3. Deploy to Vercel (Monday, 1 hour)
Goal: Working MVP by end of Month (Jan 31, 2026).
Total Cost: €10/year (domain only).
---
