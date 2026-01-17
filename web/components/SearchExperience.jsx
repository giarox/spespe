"use client"

import { useState } from 'react'
import SearchBar from '@/components/SearchBar'
import ProductsGrid from '@/components/ProductsGrid'
import ShoppingListDrawer from '@/components/ShoppingListDrawer'

export default function SearchExperience({ initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery)

  return (
    <div className="space-y-4">
      <SearchBar value={query} onChange={setQuery} />
      <ProductsGrid searchQuery={query} />
      <ShoppingListDrawer />
    </div>
  )
}
