"use client"

import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'
import { useShoppingList } from '@/components/ShoppingListContext'

const PAGE_SIZE = 36
const MAX_ITEMS = 360
const SEARCH_DEBOUNCE_MS = 200

const normalizeQuery = (value) => (value || '').trim()

const buildQuery = (searchQuery, page) => {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  if (searchQuery) {
    return supabase
      .rpc('search_products', { search_text: searchQuery })
      .range(from, to)
  }

  return supabase
    .from('products')
    .select('*')
    .order('discount_percent', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)
}

export default function ProductsGrid({ searchQuery }) {
  const sentinelRef = useRef(null)
  const { hasProduct } = useShoppingList()

  const normalizedQuery = useMemo(() => normalizeQuery(searchQuery), [searchQuery])

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['products', normalizedQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await buildQuery(normalizedQuery, pageParam)
      if (error) throw error
      return data || []
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined
      return allPages.length
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const products = data?.pages.flat().slice(0, MAX_ITEMS) || []
  const productsWithAdded = useMemo(() => products.map(p => ({ ...p, isAdded: hasProduct(p.id) })), [products, hasProduct])
  const hasMore = hasNextPage && products.length < MAX_ITEMS
  const loading = isLoading
  const loadingMore = isFetchingNextPage
  const showFuzzyHint = Boolean(normalizedQuery) && products.length > 0
  const isTransitioning = isFetching && !isFetchingNextPage

  const splitProducts = useMemo(() => {
    if (!normalizedQuery || productsWithAdded.length === 0) {
      return { exact: [], related: [] }
    }

    const queryLower = normalizedQuery.toLowerCase()
    const exact = []
    const related = []

    productsWithAdded.forEach((product) => {
      const nameLower = (product.product_name || '').toLowerCase()
      if (nameLower.includes(queryLower)) {
        exact.push(product)
      } else {
        related.push(product)
      }
    })

    return { exact, related }
  }, [productsWithAdded, normalizedQuery])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage()
        }
      },
      { rootMargin: '240px' }
    )

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [hasMore, fetchNextPage, loading, loadingMore])

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-red-500">Errore nel caricamento</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
      </div>
    )
  }

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="h-72 rounded-xl border bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  const hasExactMatches = splitProducts.exact.length > 0
  const hasRelatedResults = splitProducts.related.length > 0

  return (
    <div className="space-y-8">
      {normalizedQuery ? (
        <>
          {/* Exact Matches Section */}
          {hasExactMatches && (
            <div className="space-y-4">
              <p className="font-serif text-2xl italic text-[#6d4b42]">
                Risultati ricerca
              </p>
              <div
                className={`grid grid-cols-1 gap-6 transition-all duration-300 ${
                  isTransitioning ? 'opacity-70 blur-[1px]' : 'opacity-100'
                }`}
              >
                {splitProducts.exact.map((product) => (
                  <div key={product.id} className="transition-transform duration-300 ease-out">
                    <ProductCard product={product} isAdded={product.isAdded} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Results Section */}
          {hasRelatedResults && (
            <div className="space-y-4">
              <p className="font-serif text-2xl italic text-[#6d4b42]">
                Risultati correlati
              </p>
              <div
                className={`grid grid-cols-1 gap-6 transition-all duration-300 ${
                  isTransitioning ? 'opacity-70 blur-[1px]' : 'opacity-100'
                }`}
              >
                {splitProducts.related.map((product) => (
                  <div key={product.id} className="transition-transform duration-300 ease-out">
                    <ProductCard product={product} isAdded={product.isAdded} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!hasExactMatches && !hasRelatedResults && (
            <div className="text-center py-12">
              <p className="text-xl text-[#b18474]">Nessun risultato</p>
              <p className="text-sm text-[#caa79b] mt-2">Prova con un termine diverso</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Default Section */}
          <p className="font-serif text-[40px] italic text-[#6d4b42]">
            Le migliori offerte della settimana
          </p>
           {productsWithAdded.length > 0 ? (
             <div
               className={`grid grid-cols-1 gap-6 transition-all duration-300 ${
                 isTransitioning ? 'opacity-70 blur-[1px]' : 'opacity-100'
               }`}
             >
               {productsWithAdded.map((product) => (
                 <div key={product.id} className="transition-transform duration-300 ease-out">
                   <ProductCard product={product} isAdded={product.isAdded} />
                 </div>
               ))}
             </div>
           ) : (
            <div className="text-center py-12">
              <p className="text-xl text-[#b18474]">Nessun risultato</p>
              <p className="text-sm text-[#caa79b] mt-2">Prova con un termine diverso</p>
            </div>
          )}
        </>
      )}

      {loadingMore && (
        <div className="grid grid-cols-1 gap-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-40 rounded-[28px] border border-[#f1d6c6] bg-white/70 animate-pulse" />
          ))}
        </div>
      )}

      {hasMore ? (
        <div ref={sentinelRef} />
      ) : (
        <p className="text-center text-xs text-[#caa79b]">Fine risultati</p>
      )}
    </div>
  )
}
