"use client"

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
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
  const [items, setItems] = useState(() => loadStoredItems())

  const hasProduct = useCallback((productId) => {
    return items.some((item) => item.product?.id === productId)
  }, [items])

  const refreshItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_lists_view')
      .select('*')
      .order('added_at', { ascending: false })

    if (!error) {
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
      setItems(mapped)
      persistItems(mapped)
    }
  }, [])

  const addItem = useCallback(async (product) => {
    if (hasProduct(product.id)) {
      return { error: null }
    }

    const { data, error } = await supabase
      .from('shopping_lists')
      .upsert({ product_id: product.id }, { onConflict: 'product_id' })
      .select('id, product_id, quantity, checked')
      .single()

    if (!error && data) {
      const next = [
        {
          id: data.id,
          product,
          quantity: data.quantity,
          checked: data.checked
        },
        ...items
      ]
      setItems(next)
      persistItems(next)
    }

    return { error }
  }, [items, hasProduct])

  const removeItem = useCallback(async (id) => {
    await supabase
      .from('shopping_lists')
      .delete()
      .eq('id', id)

    const next = items.filter((item) => item.id !== id)
    setItems(next)
    persistItems(next)
  }, [items])

  const toggleItem = useCallback(async (id, checked) => {
    await supabase
      .from('shopping_lists')
      .update({ checked })
      .eq('id', id)

    const next = items.map((item) => item.id === id ? { ...item, checked } : item)
    setItems(next)
    persistItems(next)
  }, [items])

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
