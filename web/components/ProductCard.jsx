import React, { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useShoppingList } from '@/components/ShoppingListContext'
import { useHapticFeedback } from '@/lib/useHapticFeedback'

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

const ProductCard = React.memo(function ProductCard({ product, isAdded }) {
  const { addItem } = useShoppingList()
  const [isAdding, setIsAdding] = useState(false)
  const triggerHaptic = useHapticFeedback()

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
  const alreadyAdded = isAdded

  const displayDiscount = product.discount_percent
    ? (typeof product.discount_percent === 'number' || !isNaN(product.discount_percent))
      ? `${Math.round(parseFloat(product.discount_percent))}%`
      : product.discount_percent
    : null

  const metaLine = [product.weight_or_pack, product.price_per_unit]
    .filter(Boolean)
    .join(' • ')

  const handleAdd = async () => {
    if (alreadyAdded || isAdding) {
      return
    }
    triggerHaptic('light')
    setIsAdding(true)
    await addItem(product)
    setTimeout(() => setIsAdding(false), 300)
  }

  return (
    <Card className="w-full rounded-[24px] bg-white border border-solid border-[rgba(255,255,255,0.08)] shadow-[inset_0px_2px_4px_0px_rgba(255,255,255,0.12)]">
      <CardContent className="flex w-full flex-col pt-[12px] pr-[20px] pb-[16px] pl-[20px] gap-[8px]">
        <div className="flex items-center gap-[12px] w-full">
          <div className="flex-shrink-0">
            <div
              className={`relative w-[40px] h-[40px] rounded-[6px] flex items-center justify-center overflow-hidden ${
                logoUrl
                  ? 'bg-transparent'
                  : 'bg-[linear-gradient(180deg,_#FFF000_0%,_#FFF000_33%,_#E60A14_33%,_#E60A14_66%,_#0050AA_66%,_#0050AA_100%)]'
              }`}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`${product.supermarket} logo`}
                  fill
                  objectFit="contain"
                  priority
                />
              ) : (
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  {product.supermarket}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-w-0 flex-col items-start">
            <h3 className="font-sans font-semibold text-[18px] leading-[26px] text-[#561517] font-semibold">
              {formattedName}
            </h3>
            {formattedBrand && (
              <p className="font-sans font-normal text-[16px] leading-[20px] text-[rgba(74,52,47,0.9)] font-normal mt-[2px]">
                {formattedBrand}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[12px] w-full">
          <div className="flex flex-1 min-w-0 flex-col gap-[8px]">
            <div className="flex flex-wrap items-center gap-[10px] w-full min-w-0">
              <span className="font-sans font-semibold text-[24px] leading-[32px] text-[#e36e4b] font-semibold">
                {formattedCurrent}
              </span>
              {formattedOld && (
                <span className="font-sans font-normal text-[16px] text-[rgba(74,52,47,0.7)] font-normal line-through decoration-solid">
                  {formattedOld}
                </span>
              )}
              {displayDiscount && (
                <div className="flex-shrink-0 px-[7px] py-[2px] bg-[#e36e4b] text-white text-[14px] font-bold rounded-[28px] border border-solid border-[rgba(255,255,255,0.08)] shadow-[inset_0px_2px_4px_0px_rgba(255,255,255,0.12)]">
                  <span className="uppercase tracking-wider font-sans font-bold">
                    {displayDiscount}
                  </span>
                </div>
              )}
            </div>
            {metaLine && (
              <p className="font-sans font-normal text-[12px] leading-[12px] text-[rgba(74,52,47,0.8)] font-normal">
                {metaLine}
              </p>
            )}
            {Array.isArray(product.notes) && product.notes.length > 0 && (
              <p className="font-sans font-normal text-[12px] leading-[12px] text-[rgba(74,52,47,0.8)] font-normal italic">
                {product.notes.join(', ')}
              </p>
            )}
          </div>
          <Button
            aria-label={alreadyAdded ? 'Aggiunto alla Lista' : isAdding ? 'Aggiungendo...' : 'Aggiungi alla Lista'}
            className={`flex-shrink-0 w-[48px] h-[48px] font-sans font-bold text-[14px] font-bold rounded-[12px] border border-solid border-[rgba(0,0,0,0.04)] shadow-[inset_0px_-2px_4px_0px_rgba(0,0,0,0.08),inset_0px_2px_4px_0px_rgba(255,255,255,0.48)] transition-all duration-200 active:scale-95 ${
              alreadyAdded
                ? 'bg-[#16a34a] text-white'
                : isAdding
                ? 'bg-[#f7ae4b]/80 text-[#561517]'
                : 'bg-[#f7ae4b] text-[#561517] hover:bg-[#f7ae4b]/90 active:bg-[#f7ae4b]/80'
            }`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            onClick={handleAdd}
            disabled={alreadyAdded || isAdding}
          >
            {alreadyAdded ? (
              '✓'
            ) : isAdding ? (
              <svg
                className="animate-spin size-6"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                 className="size-8 !important"
              >
                <path d="M3 3.14844H4.99656L7.64988 14.3805C7.90674 15.4664 8.92351 16.1981 10.0347 16.0949L16.972 15.4518C17.9761 15.3584 18.8246 14.6676 19.1184 13.7024L20.9505 7.6981C21.1704 6.98101 20.6294 6.25614 19.8793 6.26295L5.82943 6.37679" />
                <path d="M15.0041 10.9396H11.8633" />
                <path d="M13.4338 12.5099V9.36914" />
                <path d="M8.88474 20.3448V20.463M9.36351 20.3702C9.36351 20.6361 9.14774 20.8517 8.8818 20.8517C8.61586 20.8517 8.40039 20.6361 8.40039 20.3702C8.40039 20.1043 8.61586 19.8887 8.8818 19.8887C9.14774 19.8887 9.36351 20.1043 9.36351 20.3702Z" />
                <path d="M18.0957 20.3448V20.463M18.5744 20.3702C18.5744 20.6361 18.3587 20.8517 18.0927 20.8517C17.8268 20.8517 17.6113 20.6361 17.6113 20.3702C17.6113 20.1043 17.8268 19.8887 18.0927 19.8887C18.3587 19.8887 18.5744 20.1043 18.5744 20.3702Z" />
              </svg>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})

export default ProductCard
