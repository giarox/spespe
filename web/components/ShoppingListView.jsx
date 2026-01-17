"use client"

import { useEffect, useMemo } from 'react'
import { useShoppingList } from '@/components/ShoppingListContext'

const groupByStore = (items) => {
  return items.reduce((acc, item) => {
    const store = item.product?.supermarket || 'Altro'
    if (!acc[store]) {
      acc[store] = []
    }
    acc[store].push(item)
    return acc
  }, {})
}

export default function ShoppingListView() {
  const { items, refreshItems, toggleItem, removeItem } = useShoppingList()
  const grouped = useMemo(() => groupByStore(items), [items])

  useEffect(() => {
    refreshItems()
  }, [refreshItems])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-amber-900">📝 Lista della Spesa</h1>
        <p className="text-sm text-amber-700">Una lista semplice, come su carta.</p>
      </header>

      <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50 to-white p-6 shadow-lg">
        {items.length === 0 ? (
          <p className="text-sm text-amber-700">Nessun prodotto aggiunto. Torna alle offerte e aggiungi prodotti.</p>
        ) : (
          Object.entries(grouped).map(([store, storeItems]) => (
            <div key={store} className="mb-6 last:mb-0">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                {store}
              </h2>
              <div className="mt-3 space-y-3">
                {storeItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white/70 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => toggleItem(item.id, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.checked ? 'line-through text-amber-400' : 'text-amber-900'}`}>
                        {item.product?.product_name}
                      </p>
                      {item.product?.brand && (
                        <p className="text-xs text-amber-600">{item.product.brand}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-900"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
