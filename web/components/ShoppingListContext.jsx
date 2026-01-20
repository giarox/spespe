"use client"

import { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const ShoppingListContext = createContext(null)

const STORE_KEY = 'spespe-shopping-list'

const loadStoredItems = () => {
  if (typeof window === 'undefined') {
    return []
  }
  const raw = window.localStorage.getItem(STORE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const persistItems = (items) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(STORE_KEY, JSON.stringify(items))
}

export function ShoppingListProvider({ children }) {
  const queryClient = useQueryClient()
  const queryKey = ['shopping-list']

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_lists_view')
        .select('*')
        .order('added_at', { ascending: false })

      if (error) throw error

      const mapped = (data || []).map((row) => ({
        id: row.list_id,
        product: {
          id: row.product_id,
          supermarket: row.supermarket,
          product_name: row.product_name,
          brand: row.brand,
          current_price: row.current_price,
          old_price: row.old_price,
          discount_percent: row.discount_percent,
          saving_amount: row.saving_amount,
          weight_or_pack: row.weight_or_pack,
          price_per_unit: row.price_per_unit
        },
        quantity: row.quantity,
        checked: row.checked
      }))
      persistItems(mapped)
      return mapped
    },
    initialData: loadStoredItems(),
    staleTime: 5 * 60 * 1000
  })

  const hasProduct = useCallback((productId, itemList = items) => {
    return itemList.some((item) => item.product?.id === productId)
  }, [items])

  const addMutation = useMutation({
    mutationFn: async (product) => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .upsert({ product_id: product.id }, { onConflict: 'product_id' })
        .select('id, product_id, quantity, checked')
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      if (!hasProduct(product.id, previous || [])) {
        const optimistic = [{ id: Date.now(), product, quantity: 1, checked: false }, ...(previous || [])]
        queryClient.setQueryData(queryKey, optimistic)
        persistItems(optimistic)
      }
      return { previous }
    },
    onError: (err, product, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
        persistItems(context.previous)
      }
    }
  })

  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('shopping_lists').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      const optimistic = (previous || []).filter(item => item.id !== id)
      queryClient.setQueryData(queryKey, optimistic)
      persistItems(optimistic)
      return { previous }
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
        persistItems(context.previous)
      }
    }
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }) => {
      const { error } = await supabase.from('shopping_lists').update({ checked }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      const optimistic = (previous || []).map(item => item.id === id ? { ...item, checked } : item)
      queryClient.setQueryData(queryKey, optimistic)
      persistItems(optimistic)
      return { previous }
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
        persistItems(context.previous)
      }
    }
  })

  const addItem = useCallback(async (product) => {
    if (hasProduct(product.id)) {
      return { error: null }
    }
    try {
      await addMutation.mutateAsync(product)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [addMutation, hasProduct])

  const removeItem = useCallback(async (id) => {
    try {
      await removeMutation.mutateAsync(id)
    } catch (error) {
      // handle error if needed
    }
  }, [removeMutation])

  const toggleItem = useCallback(async (id, checked) => {
    try {
      await toggleMutation.mutateAsync({ id, checked })
    } catch (error) {
      // handle error if needed
    }
  }, [toggleMutation])

  const refreshItems = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient])

  const value = useMemo(() => ({
    items,
    refreshItems,
    addItem,
    removeItem,
    toggleItem,
    hasProduct
  }), [items, refreshItems, addItem, removeItem, toggleItem, hasProduct])

  return (
    <ShoppingListContext.Provider value={value}>
      {children}
    </ShoppingListContext.Provider>
  )
}

export const useShoppingList = () => {
  const context = useContext(ShoppingListContext)
  if (!context) {
    throw new Error('useShoppingList must be used within ShoppingListProvider')
  }
  return context
}
