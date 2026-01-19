import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useShoppingList } from '@/components/ShoppingListContext'

const SUPERMARKET_LOGOS = {
  lidl: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg',
  eurospin: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Eurospin_logo.svg/2560px-Eurospin_logo.svg.png',
  'oasi tigre': 'https://oasitigre.it/favicon.ico',
  'oasi': 'https://oasitigre.it/favicon.ico',
  'tigre': 'https://oasitigre.it/favicon.ico',
}

const formatText = (text) => {
  if (!text) return ''
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

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

  const formattedName = formatText(product.product_name)
  const formattedBrand = formatText(product.brand)
  const formattedSupermarket = formatText(product.supermarket)
  const logoUrl = SUPERMARKET_LOGOS[product.supermarket?.toLowerCase()]

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

  const displayDiscount = product.discount_percent
    ? (typeof product.discount_percent === 'number' || !isNaN(product.discount_percent))
      ? `${Math.round(parseFloat(product.discount_percent))}%`
      : product.discount_percent
    : null

  const handleAdd = async () => {
    if (alreadyAdded || isAdding) {
      return
    }
    setIsAdding(true)
    await addItem(product)
    setTimeout(() => setIsAdding(false), 300)
  }

  return (
    <Card className={`overflow-hidden rounded-[32px] bg-white transition-all duration-300 ${isAdding ? 'scale-[1.02]' : ''}`}>
      <CardContent className="flex items-center gap-5 px-6 py-6">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#fdf2e9]">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={formattedName}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl opacity-20">
              📦
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {logoUrl && (
                  <img src={logoUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                )}
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#b18474]">
                  {formattedSupermarket}
                </p>
              </div>
              <h3 className="truncate text-lg font-bold text-[#4a3728] leading-tight">
                {formattedName}
              </h3>
              {formattedBrand && (
                <p className="truncate text-sm font-medium text-[#b18474]">{formattedBrand}</p>
              )}
            </div>
            {displayDiscount && (
              <span className="shrink-0 rounded-full bg-[#fdf2e9] px-2.5 py-1 text-[11px] font-bold text-[#e67e63]">
                {displayDiscount}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#e67e63]">
              {formattedCurrent}
            </span>
            {formattedOld && (
              <span className="text-sm text-[#caa79b] line-through decoration-1">
                {formattedOld}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-medium text-[#caa79b]">
            {product.weight_or_pack && <span>{product.weight_or_pack}</span>}
            {product.price_per_unit && <span>{product.price_per_unit}</span>}
          </div>

          {product.notes && product.notes.length > 0 && (
            <div className="mt-2 text-[10px] italic text-[#d39486] line-clamp-1">
              {product.notes[0]}
            </div>
          )}
        </div>

        <Button
          aria-label={alreadyAdded ? 'Aggiunto' : 'Aggiungi'}
          className={`h-12 w-12 shrink-0 rounded-full transition-all duration-300 ${
            alreadyAdded
              ? 'bg-[#f6f1ee] text-[#caa79b]'
              : 'bg-[#f16b6b] text-white shadow-[0_8px_16px_rgba(241,107,107,0.25)] hover:bg-[#e85a5a] active:scale-95'
          }`}
          size="icon"
          onClick={handleAdd}
          disabled={alreadyAdded}
        >
          <span className="text-xl">{alreadyAdded ? '✓' : '🛒'}</span>
        </Button>
      </CardContent>
    </Card>
  )
}

