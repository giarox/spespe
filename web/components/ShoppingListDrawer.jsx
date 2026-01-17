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
    <div className="fixed bottom-6 right-6 z-40 w-full max-w-sm px-4 md:px-0">
      <div className="rounded-[28px] border border-[#f1d6c6] bg-white/90 shadow-[0_20px_40px_rgba(154,115,96,0.2)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-[#f1d6c6] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#6d4b42]">Lista della Spesa</p>
            <p className="text-xs text-[#b18474]">{items.length} articoli</p>
          </div>
          <span className="text-lg">📝</span>
        </div>
        <div className="max-h-64 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-[#b18474]">Aggiungi prodotti per iniziare la lista.</p>
          ) : (
            Object.entries(grouped).map(([store, storeItems]) => (
              <div key={store} className="mb-4 last:mb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#b18474]">
                  {store}
                </p>
                <ul className="mt-2 space-y-2">
                  {storeItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => toggleItem(item.id, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[#f1d6c6] text-[#e67e63] focus:ring-[#e67e63]"
                      />
                      <div className="flex-1">
                        <p className={`text-sm ${item.checked ? 'line-through text-[#caa79b]' : 'text-[#6d4b42]'}`}>
                          {item.product?.product_name}
                        </p>
                        {item.product?.brand && (
                          <p className="text-xs text-[#b18474]">{item.product.brand}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#b18474] hover:text-[#6d4b42]"
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
