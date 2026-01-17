import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useShoppingList } from '@/components/ShoppingListContext'

const parseNumber = (value) => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return value
  }
  const digits = String(value).replace(/,/g, '.').replace(/[€\s]/g, '')
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

const formatCurrency = (value) => {
  const parsed = parseNumber(value)
  if (parsed === null) {
    return null
  }
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
  }).format(parsed)
}

export default function ProductCard({ product }) {
  const { addItem, hasProduct } = useShoppingList()
  const [isAdding, setIsAdding] = useState(false)

  const currentPrice = parseNumber(product.current_price)
  const rawOldPrice = parseNumber(product.old_price)
  const explicitSaving = parseNumber(product.saving_amount)
  const derivedOldPrice = currentPrice && explicitSaving ? currentPrice + explicitSaving : null
  const displayOldPrice = rawOldPrice && currentPrice && rawOldPrice > currentPrice
    ? rawOldPrice
    : rawOldPrice || derivedOldPrice
  const savingValue = explicitSaving || (displayOldPrice && currentPrice ? displayOldPrice - currentPrice : null)
  const formattedCurrent = formatCurrency(currentPrice) ?? '—'
  const formattedOld = displayOldPrice && currentPrice && displayOldPrice > currentPrice ? formatCurrency(displayOldPrice) : null
  const formattedSaving = savingValue ? formatCurrency(savingValue) : null
  const hasDiscount = Boolean(formattedOld || product.discount_percent)
  const alreadyAdded = hasProduct(product.id)

  const handleAdd = async () => {
    if (alreadyAdded || isAdding) {
      return
    }
    setIsAdding(true)
    await addItem(product)
    setTimeout(() => setIsAdding(false), 300)
  }

  return (
    <Card className={`overflow-hidden rounded-[32px] border border-[#f1d6c6] bg-white shadow-[0_18px_40px_rgba(154,115,96,0.12)] ${isAdding ? 'scale-[1.01]' : ''}`}>
      <CardContent className="flex items-center gap-4 px-6 py-6">
        <div className="h-20 w-24 rounded-2xl bg-[#fbe8d8] shadow-inner" />
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#6d4b42]">
                {product.product_name}
              </h3>
              {product.brand && (
                <p className="text-sm text-[#b18474]">{product.brand}</p>
              )}
            </div>
            {product.discount_percent && (
              <span className="rounded-full bg-[#f7b960] px-3 py-1 text-xs font-semibold text-[#6d4b42]">
                {product.discount_percent}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-baseline gap-4">
            <span className="text-3xl font-semibold text-[#e67e63]">
              {formattedCurrent}
            </span>
            {formattedOld && (
              <span className="text-lg text-[#caa79b] line-through">
                {formattedOld}
              </span>
            )}
          </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#b18474]">
          {product.weight_or_pack && <span>{product.weight_or_pack}</span>}
          {product.price_per_unit && <span>{product.price_per_unit}</span>}
        </div>
        {product.notes && product.notes.length > 0 && (
          <div className="mt-2 text-xs italic text-[#d39486]">
            {product.notes[0]}
          </div>
        )}
      </div>
      <Button
        aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
        className={`h-14 w-14 rounded-full bg-[#f16b6b] text-white shadow-[0_12px_24px_rgba(241,107,107,0.35)] ${
          alreadyAdded ? 'opacity-60' : 'hover:scale-105'
        }`}
        size="icon"
        onClick={handleAdd}
        disabled={alreadyAdded}
      >
        <span className="text-xl">🛒</span>
      </Button>
    </CardContent>
  </Card>
  )
}

