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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-[#6d4b42]">📝 Lista della Spesa</h1>
        <p className="text-sm text-[#b18474]">Una lista semplice, come su carta.</p>
      </header>

      <div className="rounded-[32px] border border-[#f1d6c6] bg-white/80 p-6 shadow-[0_20px_40px_rgba(154,115,96,0.18)]">
        {items.length === 0 ? (
          <p className="text-sm text-[#b18474]">Nessun prodotto aggiunto. Torna alle offerte e aggiungi prodotti.</p>
        ) : (
          Object.entries(grouped).map(([store, storeItems]) => (
            <div key={store} className="mb-6 last:mb-0">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#b18474]">
                {store}
              </h2>
              <div className="mt-3 space-y-3">
                {storeItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#f1d6c6] bg-white px-4 py-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => toggleItem(item.id, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-[#f1d6c6] text-[#e67e63] focus:ring-[#e67e63]"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.checked ? 'line-through text-[#caa79b]' : 'text-[#6d4b42]'}`}>
                        {item.product?.product_name}
                      </p>
                      {item.product?.brand && (
                        <p className="text-xs text-[#b18474]">{item.product.brand}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-semibold text-[#b18474] hover:text-[#6d4b42]"
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
