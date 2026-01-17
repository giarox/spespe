"use client"

import { useMemo } from 'react'
import { useShoppingList } from '@/components/ShoppingListContext'
import { Button } from '@/components/ui/button'

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

export default function ShoppingListDrawer() {
  const { items, removeItem, toggleItem } = useShoppingList()
  const grouped = useMemo(() => groupByStore(items), [items])

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-sm px-4 md:px-0">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-amber-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">Lista della Spesa</p>
            <p className="text-xs text-amber-700">{items.length} articoli</p>
          </div>
          <span className="text-lg">📝</span>
        </div>
        <div className="max-h-64 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-amber-700">Aggiungi prodotti per iniziare la lista.</p>
          ) : (
            Object.entries(grouped).map(([store, storeItems]) => (
              <div key={store} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {store}
                </p>
                <ul className="mt-2 space-y-2">
                  {storeItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => toggleItem(item.id, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${item.checked ? 'line-through text-amber-400' : 'text-amber-900'}`}>
                          {item.product?.product_name}
                        </p>
                        {item.product?.brand && (
                          <p className="text-xs text-amber-600">{item.product.brand}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-amber-700 hover:text-amber-900"
                        onClick={() => removeItem(item.id)}
                      >
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
