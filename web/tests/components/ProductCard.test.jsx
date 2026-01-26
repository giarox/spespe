import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductCard from '@/components/ProductCard'

// Mock the ShoppingListContext
const mockUseShoppingList = {
  items: [],
  addItem: vi.fn(),
  hasProduct: vi.fn()
}

vi.mock('@/components/ShoppingListContext', () => ({
  ShoppingListProvider: ({ children }) => <div>{children}</div>,
  useShoppingList: () => mockUseShoppingList
}))

const renderWithProvider = (ui) => render(ui)

describe('ProductCard Component', () => {
  const mockProduct = {
    id: 1,
    product_name: 'Broccoli',
    brand: null,
    current_price: 0.89,
    old_price: 1.29,
    discount_percent: '-31%',
    weight_or_pack: '500 g confezione',
    price_per_unit: '1 kg = 1,78 €',
    notes: ['Coltivato in Italia']
  }

  it('renders product name', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByText('Broccoli')).toBeInTheDocument()
  })

  it('displays current price', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByText(/0,89 €/)).toBeInTheDocument()
  })

  it('displays old price with strikethrough', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    const oldPrice = screen.getByText(/1,29 €/)
    expect(oldPrice).toBeInTheDocument()
    expect(oldPrice).toHaveClass('line-through')
  })

  it('shows discount badge', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByText('-31%')).toBeInTheDocument()
  })

  it('displays weight/pack information', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByText(/500 g confezione/)).toBeInTheDocument()
  })

  it('shows Italian notes', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByText(/Coltivato in Italia/)).toBeInTheDocument()
  })

  it('renders add to list button', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.getByRole('button', { name: /Aggiungi alla Lista/ })).toBeInTheDocument()
  })

  it('handles products without discount', () => {
    const productWithoutDiscount = {
      ...mockProduct,
      discount_percent: null,
      old_price: null
    }
    renderWithProvider(<ProductCard product={productWithoutDiscount} />)
    expect(screen.queryByText('-31%')).not.toBeInTheDocument()
  })

  it('handles products without brand', () => {
    renderWithProvider(<ProductCard product={mockProduct} />)
    expect(screen.queryByText('Brand Name')).not.toBeInTheDocument()
  })

  it('handles products with brand', () => {
    const productWithBrand = {
      ...mockProduct,
      brand: 'Realforno'
    }
    renderWithProvider(<ProductCard product={productWithBrand} />)
    expect(screen.getByText('Realforno')).toBeInTheDocument()
  })

  it('shows green background when item is added', () => {
    mockUseShoppingList.hasProduct.mockReturnValue(true)
    renderWithProvider(<ProductCard product={mockProduct} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-[#16a34a]')
    mockUseShoppingList.hasProduct.mockReturnValue(false)
  })

  it('shows white text when item is added', () => {
    mockUseShoppingList.hasProduct.mockReturnValue(true)
    renderWithProvider(<ProductCard product={mockProduct} />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('text-white')
    mockUseShoppingList.hasProduct.mockReturnValue(false)
  })

  it('cart icon has size-6 class when not added', () => {
    mockUseShoppingList.hasProduct.mockReturnValue(false)
    renderWithProvider(<ProductCard product={mockProduct} />)
    const svg = screen.getByRole('button').querySelector('svg')
    expect(svg).toHaveClass('size-6')
  })

  it('has proper accessibility labels for added state', () => {
    mockUseShoppingList.hasProduct.mockReturnValue(true)
    renderWithProvider(<ProductCard product={mockProduct} />)
    const button = screen.getByRole('button', { name: 'Aggiunto alla Lista' })
    expect(button).toBeInTheDocument()
    mockUseShoppingList.hasProduct.mockReturnValue(false)
  })

  it('has proper accessibility labels for not added state', () => {
    mockUseShoppingList.hasProduct.mockReturnValue(false)
    renderWithProvider(<ProductCard product={mockProduct} />)
    const button = screen.getByRole('button', { name: 'Aggiungi alla Lista' })
    expect(button).toBeInTheDocument()
  })
})
