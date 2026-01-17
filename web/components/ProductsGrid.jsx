"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'

const PAGE_SIZE = 36
const MAX_ITEMS = 360

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
    .order('discount_percent', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .range(from, to)
}

export default function ProductsGrid({ searchQuery }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [error, setError] = useState(null)
  const sentinelRef = useRef(null)

  const normalizedQuery = useMemo(() => normalizeQuery(searchQuery), [searchQuery])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProducts([])
    setHasMore(true)
    setPage(0)

    const { data, error: fetchError } = await buildQuery(normalizedQuery, 0)

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const freshData = data || []

    setProducts(freshData.slice(0, MAX_ITEMS))
    setHasMore(freshData.length === PAGE_SIZE)
    setLoading(false)
  }, [normalizedQuery])

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) {
      return
    }

    const nextPage = page + 1
    setLoadingMore(true)

    const { data, error: fetchError } = await buildQuery(normalizedQuery, nextPage)

    if (fetchError) {
      setError(fetchError.message)
      setLoadingMore(false)
      return
    }

    const freshData = data || []
    const updated = [...products, ...freshData]

    setProducts(updated.slice(0, MAX_ITEMS))
    setPage(nextPage)
    setHasMore(freshData.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [normalizedQuery, page, products, loadingMore, loading, hasMore])

  useEffect(() => {
    let active = true

    const run = async () => {
      if (!active) {
        return
      }
      await loadInitial()
    }

    run()

    return () => {
      active = false
    }
  }, [loadInitial])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '240px' }
    )

    observer.observe(sentinelRef.current)

    return () => observer.disconnect()
  }, [hasMore, loadMore, loading, loadingMore])

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-red-500">Errore nel caricamento</p>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
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

  return (
    <div className="space-y-4">
      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-300">
          {products.map((product) => (
            <div key={product.id} className="transition-transform duration-300 ease-out">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">Nessun risultato</p>
          <p className="text-sm text-gray-500 mt-2">Prova con un termine diverso</p>
        </div>
      )}

      {loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-72 rounded-xl border bg-white animate-pulse" />
          ))}
        </div>
      )}

      {hasMore ? (
        <div ref={sentinelRef} />
      ) : (
        <p className="text-center text-xs text-gray-400">Fine risultati</p>
      )}
    </div>
  )
}
