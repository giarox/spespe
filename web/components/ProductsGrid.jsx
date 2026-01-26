"use client"

import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'
import { useShoppingList } from '@/components/ShoppingListContext'

const PAGE_SIZE = 36
const MAX_ITEMS = 360
const SEARCH_DEBOUNCE_MS = 200
const EXACT_SCORE_THRESHOLD = 0.2
const FUZZY_SIMILARITY_THRESHOLD = 0.6 // 60% similarity for fuzzy matches

const normalizeQuery = (value) => (value || '').trim()
const normalizeForMatch = (value) => {
  if (!value) return ''
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const tokenizeMatch = (value) => {
  const normalized = normalizeForMatch(value)
  return normalized ? normalized.split(' ') : []
}

const matchesTokenSet = (queryTokens, target) => {
  if (!queryTokens.length) return false
  const targetTokens = tokenizeMatch(target)
  if (!targetTokens.length) return false
  const targetSet = new Set(targetTokens)
  return queryTokens.every((token) => targetSet.has(token))
}

// Calculate Jaro-Winkler similarity for fuzzy matching
const calculateJaroWinklerSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0
  
  const str1 = normalizeForMatch(s1)
  const str2 = normalizeForMatch(s2)
  
  if (str1 === str2) return 1
  if (!str1 || !str2) return 0
  
  const len1 = str1.length
  const len2 = str2.length
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1
  
  const matches1 = new Array(len1).fill(false)
  const matches2 = new Array(len2).fill(false)
  
  let matches = 0
  let transpositions = 0
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, len2)
    
    for (let j = start; j < end; j++) {
      if (matches2[j] || str1[i] !== str2[j]) continue
      matches1[i] = matches2[j] = true
      matches++
      break
    }
  }
  
  if (matches === 0) return 0
  
  // Count transpositions
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++
      if (str1[i] !== str2[k]) transpositions++
      k++
    }
  }
  
  transpositions /= 2
  
  const jaro =
    matches / len1 + matches / len2 + (matches - transpositions) / matches
  const jaroSimilarity = jaro / 3
  
  // Winkler bonus for common prefix
  let prefix = 0
  const maxPrefix = 4
  for (let i = 0; i < Math.min(len1, len2, maxPrefix); i++) {
    if (str1[i] === str2[i]) prefix++
    else break
  }
  
  const winklerBonus = 0.1 * Math.min(prefix, maxPrefix) * (1 - jaroSimilarity)
  
  return Math.min(1, jaroSimilarity + winklerBonus)
}

// Check if query matches target with fuzzy logic
const fuzzyMatches = (query, target) => {
  if (!query || !target) return { matches: false, score: 0 }
  
  const queryTokens = tokenizeMatch(query)
  const targetTokens = tokenizeMatch(target)
  
  if (!queryTokens.length || !targetTokens.length) {
    return { matches: false, score: 0 }
  }
  
  // Check each query token against each target token
  let totalScore = 0
  let matchedTokens = 0
  
  for (const queryToken of queryTokens) {
    let bestMatchScore = 0
    
    for (const targetToken of targetTokens) {
      const similarity = calculateJaroWinklerSimilarity(queryToken, targetToken)
      if (similarity > bestMatchScore) {
        bestMatchScore = similarity
      }
    }
    
    if (bestMatchScore >= FUZZY_SIMILARITY_THRESHOLD) {
      totalScore += bestMatchScore
      matchedTokens++
    }
  }
  
  if (matchedTokens === 0) {
    return { matches: false, score: 0 }
  }
  
  const averageScore = totalScore / matchedTokens
  return {
    matches: averageScore >= FUZZY_SIMILARITY_THRESHOLD,
    score: averageScore
  }
}

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
      
      // If we have results or no query, return them
      if (data?.length || !normalizedQuery) {
        return data || []
      }
      
      // If no results and we have a query, fetch all products for client-side fuzzy matching
      // Only do this on the first page (pageParam === 0)
      if (pageParam === 0 && normalizedQuery) {
        const { data: allProducts, error: allError } = await supabase
          .from('products')
          .select('*')
          .order('discount_percent', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true })
          .limit(1000) // Limit to prevent excessive memory usage
        
        if (allError) throw allError
        
        // Apply fuzzy matching on the client side
        const fuzzyResults = allProducts
          .map((product) => {
            const nameMatch = fuzzyMatches(normalizedQuery, product.product_name)
            const brandMatch = fuzzyMatches(normalizedQuery, product.brand)
            
            if (nameMatch.matches || brandMatch.matches) {
              return {
                ...product,
                _fuzzyScore: Math.max(nameMatch.score, brandMatch.score),
                _isFuzzyMatch: true
              }
            }
            return null
          })
          .filter(Boolean)
          .sort((a, b) => b._fuzzyScore - a._fuzzyScore)
          .slice(0, PAGE_SIZE)
        
        return fuzzyResults
      }
      
      return []
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Don't paginate fuzzy results
      if (lastPage.some(p => p._isFuzzyMatch)) return undefined
      if (lastPage.length < PAGE_SIZE) return undefined
      return allPages.length
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const products = useMemo(() => data?.pages.flat().slice(0, MAX_ITEMS) || [], [data])
  const productsWithAdded = useMemo(() => products.map(p => ({ ...p, isAdded: hasProduct(p.id) })), [products, hasProduct])
  const hasMore = hasNextPage && products.length < MAX_ITEMS
  const loading = isLoading
  const loadingMore = isFetchingNextPage
  const isTransitioning = isFetching && !isFetchingNextPage
  
  // Check if any product is a fuzzy match
  const hasFuzzyMatches = products.some(p => p._isFuzzyMatch)
  const showFuzzyHint = Boolean(normalizedQuery) && hasFuzzyMatches

  const matchTokens = useMemo(() => tokenizeMatch(normalizedQuery), [normalizedQuery])

  const splitProducts = useMemo(() => {
    if (!normalizedQuery || productsWithAdded.length === 0) {
      return { exact: [], related: [] }
    }

    const exact = []
    const related = []
    const fuzzy = []

    productsWithAdded.forEach((product) => {
      // Check for fuzzy matches first
      if (product._isFuzzyMatch) {
        fuzzy.push(product)
        return
      }
      
      const matchesName = matchesTokenSet(matchTokens, product.product_name)
      const matchesBrand = matchesTokenSet(matchTokens, product.brand)
      const hasScoreMatch =
        matchTokens.length === 0 &&
        typeof product.score === 'number' &&
        product.score >= EXACT_SCORE_THRESHOLD
      if (matchesName || matchesBrand || hasScoreMatch) {
        exact.push(product)
      } else {
        related.push(product)
      }
    })

    // If we have fuzzy matches but no exact matches, show them as exact matches
    if (exact.length === 0 && fuzzy.length > 0) {
      return { exact: fuzzy, related: [] }
    }

    return { exact, related }
  }, [productsWithAdded, normalizedQuery, matchTokens])

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
              <div className="flex items-center justify-between">
                <p className="font-serif text-2xl italic text-[#6d4b42]">
                  Risultati ricerca
                </p>
                {showFuzzyHint && (
                  <span className="text-sm text-[#caa79b] italic">
                    Risultati corretti per &quot;{normalizedQuery}&quot;
                  </span>
                )}
              </div>
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
