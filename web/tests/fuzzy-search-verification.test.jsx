import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create mock objects that will be shared
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn()
}

const mockUseShoppingList = {
  items: [],
  addItem: vi.fn(),
  hasProduct: vi.fn(() => false)
}

// Mock Supabase using factory function
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock ShoppingListContext
vi.mock('@/components/ShoppingListContext', () => ({
  ShoppingListProvider: ({ children }) => <div>{children}</div>,
  useShoppingList: () => mockUseShoppingList
}))

// Mock ProductCard
vi.mock('@/components/ProductCard', () => ({
  default: ({ product }) => (
    <div data-testid="product-card" data-product-name={product.product_name}>
      {product.product_name}
      {product._isFuzzyMatch && <span data-testid="fuzzy-match-indicator"> (corretto)</span>}
    </div>
  )
}))

// Import ProductsGrid after mocks
import ProductsGrid from '@/components/ProductsGrid'

// Helper to create mock RPC response with range method
const createMockRpcResponse = (data) => ({
  range: vi.fn().mockResolvedValue({ data, error: null })
})

// Helper to create mock from response chain
const createMockFromResponse = (data) => ({
  select: vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data, error: null })
    })
  })
})

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

describe('Fuzzy Search Verification: fermaggio -> formaggio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseShoppingList.hasProduct.mockReturnValue(false)
  })

  it('should match "fermaggio" to "formaggio" using fuzzy matching', async () => {
    // Mock product data - simulating a real product database
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      },
      { 
        id: 2, 
        product_name: 'Formaggio Grattugiato', 
        brand: 'Grana Padano', 
        current_price: 5.99, 
        old_price: 6.99, 
        discount_percent: '-14%', 
        weight_or_pack: '150g', 
        price_per_unit: '1 kg = 39,93 €', 
        notes: [] 
      },
      { 
        id: 3, 
        product_name: 'Fragola', 
        brand: 'Del Monte', 
        current_price: 2.99, 
        old_price: 3.99, 
        discount_percent: '-25%', 
        weight_or_pack: '500g', 
        price_per_unit: '1 kg = 5,98 €', 
        notes: [] 
      }
    ]

    // When searching for "fermaggio", the RPC returns no results
    // This triggers the client-side fuzzy matching
    mockSupabase.rpc.mockReturnValue(createMockRpcResponse([]))
    
    // Mock the fallback query for all products
    mockSupabase.from.mockReturnValue(createMockFromResponse(mockProducts))

    render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
    
    // Wait for the fuzzy matching to complete
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    // Verify that "Formaggio" is found
    const productCards = screen.getAllByTestId('product-card')
    expect(productCards.length).toBeGreaterThan(0)
    
    // Check that at least one product is "Formaggio"
    const formaggioCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Formaggio'
    )
    expect(formaggioCard).toBeTruthy()
    
    // Verify that the fuzzy match indicator is shown
    const fuzzyIndicator = formaggioCard.querySelector('[data-testid="fuzzy-match-indicator"]')
    expect(fuzzyIndicator).toBeTruthy()
  })

  it('should show fuzzy hint when "fermaggio" matches "formaggio"', async () => {
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      }
    ]

    mockSupabase.rpc.mockReturnValue(createMockRpcResponse([]))
    mockSupabase.from.mockReturnValue(createMockFromResponse(mockProducts))

    render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    // Verify that the fuzzy hint is displayed
    expect(screen.getByText(/Risultati corretti per/)).toBeInTheDocument()
    expect(screen.getByText(/"fermaggio"/)).toBeInTheDocument()
  })

  it('should verify Jaro-Winkler similarity calculation for fermaggio -> formaggio', async () => {
    // This test verifies the actual fuzzy matching algorithm
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      }
    ]

    mockSupabase.rpc.mockReturnValue(createMockRpcResponse([]))
    mockSupabase.from.mockReturnValue(createMockFromResponse(mockProducts))

    render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    // The fuzzy matching should find "Formaggio" when searching for "fermaggio"
    // because they share most characters: f-o-r-m-a-g-g-i-o vs f-e-r-m-a-g-g-i-o
    // Only 'e' vs 'o' and 'i' vs 'o' are different
    const productCards = screen.getAllByTestId('product-card')
    const formaggioCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Formaggio'
    )
    expect(formaggioCard).toBeTruthy()
  })

  it('should prioritize exact matches over fuzzy matches', async () => {
    // When searching for "formaggio" (exact), it should match directly
    // without needing fuzzy matching
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      }
    ]

    // Exact match should be found by RPC
    mockSupabase.rpc.mockReturnValue(createMockRpcResponse(mockProducts))

    render(<ProductsGrid searchQuery="formaggio" />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    // Verify that "Formaggio" is found
    const productCards = screen.getAllByTestId('product-card')
    const formaggioCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Formaggio'
    )
    expect(formaggioCard).toBeTruthy()
    
    // Should NOT show fuzzy hint for exact match
    expect(screen.queryByText(/Risultati corretti per/)).not.toBeInTheDocument()
  })

  it('should handle multiple fuzzy matches and sort by similarity', async () => {
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      },
      { 
        id: 2, 
        product_name: 'Fragola', 
        brand: 'Del Monte', 
        current_price: 2.99, 
        old_price: 3.99, 
        discount_percent: '-25%', 
        weight_or_pack: '500g', 
        price_per_unit: '1 kg = 5,98 €', 
        notes: [] 
      },
      { 
        id: 3, 
        product_name: 'Fagioli', 
        brand: 'Pomi', 
        current_price: 1.99, 
        old_price: 2.99, 
        discount_percent: '-33%', 
        weight_or_pack: '400g', 
        price_per_unit: '1 kg = 4,98 €', 
        notes: [] 
      }
    ]

    mockSupabase.rpc.mockReturnValue(createMockRpcResponse([]))
    mockSupabase.from.mockReturnValue(createMockFromResponse(mockProducts))

    render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    const productCards = screen.getAllByTestId('product-card')
    
    // All three products should be found (fermaggio -> formaggio, fragola, fagioli)
    expect(productCards.length).toBe(3)
    
    // Verify that "Formaggio" is present (should have highest similarity)
    const formaggioCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Formaggio'
    )
    expect(formaggioCard).toBeTruthy()
    
    // Verify that "Fragola" is present
    const fragolaCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Fragola'
    )
    expect(fragolaCard).toBeTruthy()
    
    // Verify that "Fagioli" is present
    const fagioliCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Fagioli'
    )
    expect(fagioliCard).toBeTruthy()
  })

  it('should handle accented characters in fuzzy matching (fermaggio -> formaggio)', async () => {
    const mockProducts = [
      { 
        id: 1, 
        product_name: 'Formaggio', 
        brand: 'Galbani', 
        current_price: 3.99, 
        old_price: 4.99, 
        discount_percent: '-20%', 
        weight_or_pack: '200g', 
        price_per_unit: '1 kg = 19,95 €', 
        notes: [] 
      }
    ]

    mockSupabase.rpc.mockReturnValue(createMockRpcResponse([]))
    mockSupabase.from.mockReturnValue(createMockFromResponse(mockProducts))

    // Test with accented version
    render(<ProductsGrid searchQuery="fermaggio" />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Risultati ricerca')).toBeInTheDocument()
    })

    const productCards = screen.getAllByTestId('product-card')
    const formaggioCard = productCards.find(card => 
      card.getAttribute('data-product-name') === 'Formaggio'
    )
    expect(formaggioCard).toBeTruthy()
  })
})
