# Spespe

Spespe is a full-stack application that scrapes Italian supermarket flyer data and provides a modern web interface for multi-store analysis and visualization.

## Features

- **Automated Scraping**: Captures flyer data from Italian supermarkets using Playwright and AI-powered vision models
- **Web Dashboard**: Interactive web app for browsing, searching, and analyzing flyer data
- **Performance Optimized**: Built with Next.js for fast loading and SEO
- **Accessible & Mobile-First**: Designed with accessibility in mind and optimized for all devices
- **Real-time Sync**: Data synced to Supabase for reliable storage and querying

## Stack

### Backend/Scraper
- **Automation**: Playwright with Chromium
- **Vision Model**: Gemini 2.5 Flash via OpenRouter
- **Workflow**: `.github/workflows/spotter.yml`
- **Storage**: Supabase for data persistence

### Frontend/Web App
- **Framework**: Next.js 16
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Database Client**: Supabase JS
- **State Management**: TanStack Query
- **Deployment**: Vercel

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 18+
- Supabase account (for database)

### Scraper Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/spespe.git
   cd spespe
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables in `.env`:
   ```
   OPENROUTER_API_KEY=your_openrouter_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   ```

### Web App Setup
1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to access the web app.

## Running the Scraper

To run the scraper manually:
```bash
python scraper/main.py  # Adjust path as needed
```

The scraper can also be triggered via GitHub Actions workflow.

## Deployment

### Web App
1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Scraper
The scraper runs via GitHub Actions. Ensure your repository secrets are configured with the necessary API keys.

## Testing

### Web App
```bash
cd web
npm test
```

### Scraper
```bash
pytest
```

## Documentation

- [Product Vision & Roadmap](docs/PRODUCT_VISION.md)
- [API Documentation](docs/api.md) (if available)
- [Contributing Guide](CONTRIBUTING.md) (if available)

## License

[Add license information here]
