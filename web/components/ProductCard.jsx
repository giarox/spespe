import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShoppingList } from '@/components/ShoppingListContext'

const SUPERMARKET_LOGOS = {
  lidl: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Lidl-Logo.svg',
  eurospin: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Eurospin_Logo.svg',
  'oasi tigre': 'https://www.oasitigre.it/etc.clientlibs/oasitigre/clientlibs-ot/clientlib-site/resources/images/logo-oasitigre.svg',
  'oasi': 'https://www.oasitigre.it/etc.clientlibs/oasitigre/clientlibs-ot/clientlib-site/resources/images/logo-oasitigre.svg',
  'tigre': 'https://www.oasitigre.it/etc.clientlibs/oasitigre/clientlibs-ot/clientlib-site/resources/images/logo-oasitigre.svg',
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
  const logoUrl = SUPERMARKET_LOGOS[product.supermarket?.toLowerCase()]

  const currentPrice = parseNumber(product.current_price)
  const rawOldPrice = parseNumber(product.old_price)
  const explicitSaving = parseNumber(product.saving_amount)
  const derivedOldPrice = currentPrice && explicitSaving ? currentPrice + explicitSaving : null
  const displayOldPrice = rawOldPrice && currentPrice && rawOldPrice > currentPrice
    ? rawOldPrice
    : rawOldPrice || derivedOldPrice
  const formattedCurrent = formatCurrency(currentPrice) ?? '—'
  const formattedOld = displayOldPrice && currentPrice && displayOldPrice > currentPrice ? formatCurrency(displayOldPrice) : null
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
    <Card className={`overflow-hidden rounded-[20px] bg-white transition-all duration-300 ${isAdding ? 'scale-[1.02]' : ''}`}>
      <CardContent className="flex h-[110px] items-start gap-[12px] px-[16px] py-[12px]">
        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center">
          {logoUrl && (
            <img src={logoUrl} alt="" className="h-full w-full object-contain" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold leading-tight text-[#4a3728]">
                {formattedName}
              </h3>
              {formattedBrand && (
                <p className="truncate text-[12px] font-medium text-[#b18474]">{formattedBrand}</p>
              )}
            </div>
            {displayDiscount && (
              <span className="shrink-0 rounded-full bg-[#fff4d6] px-[8px] text-[11px] font-semibold leading-[20px] text-[#b4690e]">
                {displayDiscount}
              </span>
            )}
          </div>

          <div className="mt-[6px] flex items-center justify-between gap-[12px]">
            <div className="flex items-baseline gap-[8px]">
              <span className="text-[18px] font-extrabold text-[#d6731d]">
                {formattedCurrent}
              </span>
              {formattedOld && (
                <span className="text-[12px] text-[#caa79b] line-through decoration-1">
                  {formattedOld}
                </span>
              )}
            </div>
            <Button
              aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
              className={`h-[32px] shrink-0 rounded-full px-[14px] text-[12px] font-semibold transition-all duration-300 ${
                alreadyAdded
                  ? 'bg-[#f6f1ee] text-[#caa79b]'
                  : 'bg-[#f6c144] text-[#4a3728] shadow-[0_8px_16px_rgba(246,193,68,0.35)] hover:bg-[#efb534] active:scale-95'
              }`}
              onClick={handleAdd}
              disabled={alreadyAdded}
            >
              {alreadyAdded ? '✓' : 'Aggiungi'}
            </Button>
          </div>

          <div className="mt-auto flex flex-wrap gap-[8px] text-[11px] font-medium text-[#caa79b]">
            {product.weight_or_pack && <span>{product.weight_or_pack}</span>}
            {product.price_per_unit && <span>{product.price_per_unit}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

