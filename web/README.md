# Spespe Web

Spespe Web is a modern, responsive web application for checking grocery offers and managing shopping lists. Built with Next.js and designed for optimal performance and accessibility.

## Features

### Core Functionality
- **Product Search and Browsing**: Search through grocery products with real-time results and filtering
- **Shopping List Management**: Create and manage shopping lists with haptic feedback for mobile devices
- **Offer Tracking**: Stay updated with current grocery store offers and promotions
- **Responsive Design**: Fully responsive layout that works seamlessly across desktop, tablet, and mobile devices

### Performance Optimizations
- **Incremental Static Regeneration (ISR)**: Products are revalidated every hour for fresh data
- **React Query Caching**: Efficient data fetching and caching with TanStack React Query
- **Optimized Builds**: Next.js automatic code splitting and optimization
- **Lazy Loading**: Components and images are loaded on demand

### Accessibility
- **WCAG Compliant**: Built with Radix UI primitives ensuring high accessibility standards
- **Keyboard Navigation**: Full support for keyboard and screen reader navigation
- **Focus Management**: Proper focus indicators and management throughout the app
- **Semantic HTML**: Proper semantic markup for better screen reader support

### Mobile-First Design
- **Touch-Friendly Interface**: Optimized for touch interactions with appropriate button sizes
- **Haptic Feedback**: Native haptic feedback on supported devices for better user experience
- **Responsive Typography**: Scalable text sizing that adapts to different screen sizes
- **Progressive Web App Ready**: Can be easily converted to a PWA with service workers

## Technology Stack

### Frontend Framework
- **Next.js 16**: React framework with App Router, server-side rendering, and static generation
- **React 19**: Latest React version with concurrent features and automatic batching

### UI and Styling
- **Tailwind CSS 4**: Utility-first CSS framework for rapid UI development
- **Radix UI**: Unstyled, accessible UI primitives for consistent design system
- **Lucide React**: Beautiful, customizable icons
- **Class Variance Authority**: Type-safe CSS class management
- **Tailwind Merge**: Utility for merging Tailwind classes efficiently

### Data and State Management
- **Supabase**: PostgreSQL database with real-time subscriptions and authentication
- **TanStack React Query**: Powerful data synchronization for server state

### Development and Testing
- **Vitest**: Fast unit testing framework with native ESM support
- **Testing Library**: Simple and complete testing utilities
- **ESLint**: Code linting with Next.js configuration
- **Happy DOM**: Lightweight DOM implementation for testing

## Development Setup

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm or yarn package manager

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd spespe/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see Environment Variables section below)

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000` in your browser

### Environment Variables

Create a `.env.local` file in the web directory with the following variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

Example:
```
NEXT_PUBLIC_SUPABASE_URL=https://jttjtsnosmptxzwfhoig.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Available Scripts and Commands

- `npm run dev`: Start the development server with hot reloading
- `npm run build`: Build the application for production
- `npm run start`: Start the production server (requires build first)
- `npm run lint`: Run ESLint to check code quality
- `npm run test`: Run tests once
- `npm run test:watch`: Run tests in watch mode
- `npm run test:ui`: Run tests with interactive UI
- `npm run test:coverage`: Run tests with coverage report

## Testing Information

### Test Framework
The project uses **Vitest** for unit testing with **Testing Library** for component testing.

### Running Tests
```bash
# Run all tests once
npm run test

# Run tests in watch mode (recommended during development)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Structure
- Tests are located in the `tests/` directory
- Component tests use `.test.jsx` extension
- Setup file: `tests/setup.js`
- Configuration: `vitest.config.js`

### Writing Tests
Tests follow Testing Library best practices:
- Focus on user behavior rather than implementation details
- Use descriptive test names
- Prefer `getByRole` and semantic queries

## Deployment Details

### Build Process
1. The application builds static assets and server-side code
2. Next.js optimizes bundles automatically
3. ISR pages are generated at build time

### Deployment Platforms
Recommended deployment platforms for Next.js:
- **Vercel**: Optimal for Next.js with automatic deployments and ISR support
- **Netlify**: Good alternative with serverless functions
- **Railway/AWS Amplify**: For more control over infrastructure

### Production Environment Variables
Ensure all production environment variables are set in your deployment platform:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Build Command
```bash
npm run build
```

### Start Command
```bash
npm run start
```

## Performance Monitoring Tips

### Built-in Next.js Analytics
Enable Next.js Analytics for real user monitoring:
```javascript
// In next.config.js
module.exports = {
  experimental: {
    webVitalsAttribution: ['CLS', 'LCP'],
  },
}
```

### Lighthouse Audits
Regularly run Lighthouse audits to monitor:
- Performance score
- Accessibility compliance
- Best practices
- SEO optimization

### React DevTools Profiler
Use React DevTools to profile component re-renders and identify performance bottlenecks.

### Core Web Vitals
Monitor these key metrics:
- **Largest Contentful Paint (LCP)**: Time to load largest content element
- **First Input Delay (FID)**: Responsiveness to user input
- **Cumulative Layout Shift (CLS)**: Visual stability of the page

### Database Query Optimization
- Use Supabase's query planner to optimize database queries
- Implement proper indexing on frequently queried columns
- Monitor query performance with Supabase dashboard

### Bundle Analysis
Analyze bundle sizes to identify large dependencies:
```bash
npm install --save-dev @next/bundle-analyzer
```

Add to package.json scripts:
```json
{
  "analyze": "ANALYZE=true npm run build"
}
```

### Caching Strategies
- Leverage browser caching for static assets
- Use appropriate cache headers for API responses
- Implement proper cache invalidation for dynamic content

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Run linting and tests before submitting PRs
4. Ensure accessibility standards are maintained
5. Test on multiple devices and browsers

## Support

For questions or issues:
- Check existing GitHub issues
- Create a new issue with detailed information
- Include browser/OS details and steps to reproduce
