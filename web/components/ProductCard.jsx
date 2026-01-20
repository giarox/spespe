import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShoppingList } from '@/components/ShoppingListContext'

const SUPERMARKET_LOGOS = {
  lidl: '/logos/lidl-logo.png',
  eurospin: '/logos/eurospin-logo.png',
  'oasi tigre': '/logos/oasi-tigre-logo.png',
  'oasi': '/logos/oasi-tigre-logo.png',
  'tigre': '/logos/oasi-tigre-logo.png',
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

  const metaLine = [product.weight_or_pack, product.price_per_unit]
    .filter(Boolean)
    .join('  ')

  const handleAdd = async () => {
    if (alreadyAdded || isAdding) {
      return
    }
    setIsAdding(true)
    await addItem(product)
    setTimeout(() => setIsAdding(false), 300)
  }

  return (
    <Card className="product-card">
      <CardContent className="flex py-4 px-3">
        <div className="logo-product">
          <div className={`chain-logo ${logoUrl ? 'no-overlay' : ''}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain p-[4px]" />
            ) : (
              <span className="chain-logo-text">
                {product.supermarket}
              </span>
            )}
          </div>
        </div>
        <div className="w-[16px]" />
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="product">
              <h3 className="product-name">
                {formattedName}
              </h3>
              {formattedBrand && (
                <p className="brand-name">
                  {formattedBrand}
                </p>
              )}
            </div>
            {displayDiscount && (
              <div className="discount-chip">
                <span className="discount-text">
                  {displayDiscount}
                </span>
              </div>
            )}
          </div>
          <div className="infos-button">
            <div className="additional-infos">
              <div className="prices-discount">
                <span className="offer-price">
                  {formattedCurrent}
                </span>
                {formattedOld && (
                  <span className="old-price line-through">
                    {formattedOld}
                  </span>
                )}
              </div>
              {metaLine && (
                <p className="weight-info">
                  {metaLine}
                </p>
              )}
              {Array.isArray(product.notes) && product.notes.length > 0 && (
                <p className="notes">
                  {product.notes.join(', ')}
                </p>
              )}
            </div>
            <Button
              aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
              className={`button ${
                alreadyAdded
                  ? 'bg-[#f6f1ee] text-[#caa79b]'
                  : 'bg-[#FCBE69] text-[#71393B] hover:bg-[#FCBE69]/90'
              }`}
              onClick={handleAdd}
              disabled={alreadyAdded}
            >
              {alreadyAdded ? (
                '✓'
              ) : (
                <>
                  Aggiungi
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon"
                  >
                    <path d="M3 3.14844H4.99656L7.64988 14.3805C7.90674 15.4664 8.92351 16.1981 10.0347 16.0949L16.972 15.4518C17.9761 15.3584 18.8246 14.6676 19.1184 13.7024L20.9505 7.6981C21.1704 6.98101 20.6294 6.25614 19.8793 6.26295L5.82943 6.37679" />
                    <path d="M15.0041 10.9396H11.8633" />
                    <path d="M13.4338 12.5099V9.36914" />
                    <path d="M8.88474 20.3448V20.463M9.36351 20.3702C9.36351 20.6361 9.14774 20.8517 8.8818 20.8517C8.61586 20.8517 8.40039 20.6361 8.40039 20.3702C8.40039 20.1043 8.61586 19.8887 8.8818 19.8887C9.14774 19.8887 9.36351 20.1043 9.36351 20.3702Z" />
                    <path d="M18.0957 20.3448V20.463M18.5744 20.3702C18.5744 20.6361 18.3587 20.8517 18.0927 20.8517C17.8268 20.8517 17.6113 20.6361 17.6113 20.3702C17.6113 20.1043 17.8268 19.8887 18.0927 19.8887C18.3587 19.8887 18.5744 20.1043 18.5744 20.3702Z" />
                  </svg>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
