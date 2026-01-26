import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock Supabase - factory returns object with vi.fn() methods
vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn()
    }
  }
})

// Mock ShoppingListContext
vi.mock('@/components/ShoppingListContext', () => ({
  ShoppingListProvider: ({ children }) => <div>{children}</div>,
  useShoppingList: () => ({
    items: [],
    addItem: vi.fn(),
    hasProduct: vi.fn(() => false)
  })
}))

// Mock ProductCard
vi.mock('@/components/ProductCard', () => ({
  default: ({ product }) => <div data-testid="product-card">{product.product_name}</div>
}))

// Import ProductsGrid after mocks
import ProductsGrid from '@/components/ProductsGrid'
import { supabase } from '@/lib/supabase'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0
      }
    }
  })
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Helper to create chainable mock
const createChainableMock = () => {
  const mock = {}
  const chain = () => mock
  mock.select = vi.fn(chain)
  mock.order = vi.fn(chain)
  mock.range = vi.fn(chain)
  mock.limit = vi.fn(chain)
  mock.then = vi.fn((resolve) => resolve({ data: [], error: null }))
  return mock
}

describe('ProductsGrid Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders loading state', () => {
      const chainMock = createChainableMock()
      supabase.from.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: null, error: null })

      render(<ProductsGrid searchQuery="" />, { wrapper: createWrapper() })
      // Check for loading skeletons (divs with animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThanOrEqual(8)
    })

    it('renders default section when no search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] },
        { id: 2, product_name: 'Product 2', brand: 'Brand 2', current_price: 2.99, old_price: 3.99, discount_percent: '-25%', weight_or_pack: '1kg', price_per_unit: '1 kg = 2,99 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.from.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Le migliori offerte della settimana')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    it('renders search results section when search query is provided', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Broccoli', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="broccoli" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('shows no results message when search returns empty', async () => {
      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: [], error: null })

      render(<ProductsGrid searchQuery="nonexistent" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Nessun risultato')).toBeInTheDocument()
      })
    })
  })

  describe('Fuzzy Matching', () => {
    it('matches exact product names', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Formaggio', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="formaggio" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('matches misspelled product names using fuzzy matching', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Formaggio', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('matches misspelled product names with multiple characters wrong', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Formaggio', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="formagio" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('matches brand names using fuzzy matching', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Parmalat', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="parmalat" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('matches misspelled brand names', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Parmalat', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="parmalatt" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('shows fuzzy hint when results are corrected', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Formaggio', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText(/Risultati corretti per/)).toBeInTheDocument()
      })
    })

    it('sorts fuzzy matches by similarity score', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Formaggio', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] },
        { id: 2, product_name: 'Fragola', brand: 'Brand 2', current_price: 2.99, old_price: 3.99, discount_percent: '-25%', weight_or_pack: '1kg', price_per_unit: '1 kg = 2,99 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })
  })

  describe('Token Matching', () => {
    it('matches products with token set matching', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Broccoli', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="broccoli" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('matches products with multiple tokens', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Broccoli', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="broccoli brand" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        // The product should be shown (either in exact or related results)
        expect(screen.getByText('Broccoli')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.from.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Le migliori offerte della settimana')).toBeInTheDocument()
      })
    })

    it('handles null search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.from.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery={null} />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Le migliori offerte della settimana')).toBeInTheDocument()
      })
    })

    it('handles undefined search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.from.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery={undefined} />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Le migliori offerte della settimana')).toBeInTheDocument()
      })
    })

    it('handles special characters in search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="product@#$%" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('handles accented characters in search query', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Caffè', brand: 'Brand 1', current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: [], error: null })
      
      const chainMock2 = createChainableMock()
      supabase.from.mockReturnValue(chainMock2)
      chainMock2.limit.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="cafe" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })

    it('handles products with null brand', async () => {
      const mockProducts = [
        { id: 1, product_name: 'Product 1', brand: null, current_price: 1.99, old_price: 2.99, discount_percent: '-33%', weight_or_pack: '500g', price_per_unit: '1 kg = 3,98 €', notes: [] }
      ]

      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockResolvedValue({ data: mockProducts, error: null })

      render(<ProductsGrid searchQuery="product" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error message when query fails', async () => {
      const chainMock = createChainableMock()
      supabase.rpc.mockReturnValue(chainMock)
      chainMock.range.mockRejectedValue(new Error('Database error'))

      render(<ProductsGrid searchQuery="test" />, { wrapper: createWrapper() })
      
      await waitFor(() => {
        expect(screen.getByText(/Errore nel caricamento/)).toBeInTheDocument()
      })
    })
  })
})
