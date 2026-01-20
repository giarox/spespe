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
    <Card className="w-full rounded-[24px] bg-white border border-solid border-[rgba(255,255,255,0.08)] shadow-[inset_0px_2px_4px_0px_rgba(255,255,255,0.12)]">
      <CardContent className="flex w-full flex-col pt-[12px] pr-[20px] pb-[16px] pl-[20px] gap-[8px]">
        <div className="flex items-center gap-[12px] w-full">
          <div className="flex-shrink-0">
            <div
              className={`w-[clamp(1.75rem,6vw,2.25rem)] aspect-square rounded-[6px] flex items-center justify-center overflow-hidden ${
                logoUrl
                  ? 'bg-transparent'
                  : 'bg-[linear-gradient(180deg,_#FFF000_0%,_#FFF000_33%,_#E60A14_33%,_#E60A14_66%,_#0050AA_66%,_#0050AA_100%)]'
              }`}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-[4px]" />
              ) : (
                <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                  {product.supermarket}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-w-0 flex-col items-start">
            <h3 className="font-['Vend_Sans:SemiBold',sans-serif] text-[18px] leading-[26px] text-[#561517] font-semibold">
              {formattedName}
            </h3>
            {formattedBrand && (
              <p className="font-['Vend_Sans:Regular',sans-serif] text-[16px] leading-[20px] text-[rgba(113,57,59,0.72)] font-normal mt-[2px]">
                {formattedBrand}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[12px] w-full">
          <div className="flex flex-1 min-w-0 flex-col gap-[8px]">
            <div className="flex flex-wrap items-center gap-[10px] w-full min-w-0">
              <span className="font-['Vend_Sans:SemiBold',sans-serif] text-[24px] leading-[32px] text-[#e36e4b] font-semibold">
                {formattedCurrent}
              </span>
              {formattedOld && (
                <span className="font-['Vend_Sans:Regular',sans-serif] text-[16px] text-[rgba(113,57,59,0.4)] font-normal line-through decoration-solid">
                  {formattedOld}
                </span>
              )}
              {displayDiscount && (
                <div className="flex-shrink-0 px-[7px] py-[2px] bg-[#e36e4b] text-white text-[14px] font-bold rounded-[28px] border border-solid border-[rgba(255,255,255,0.08)] shadow-[inset_0px_2px_4px_0px_rgba(255,255,255,0.12)]">
                  <span className="uppercase tracking-wider font-['Vend_Sans:Bold',sans-serif]">
                    {displayDiscount}
                  </span>
                </div>
              )}
            </div>
            {metaLine && (
              <p className="font-['Vend_Sans:Regular',sans-serif] text-[12px] leading-[12px] text-[rgba(113,57,59,0.64)] font-normal">
                {metaLine}
              </p>
            )}
            {Array.isArray(product.notes) && product.notes.length > 0 && (
              <p className="font-['Vend_Sans:Regular',sans-serif] text-[12px] leading-[12px] text-[rgba(113,57,59,0.64)] font-normal italic">
                {product.notes.join(', ')}
              </p>
            )}
          </div>
          <Button
            aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
            className={`flex-shrink-0 w-[clamp(2.5rem,12vw,3.25rem)] aspect-square font-['Vend_Sans:Bold',sans-serif] text-[14px] font-bold rounded-[12px] border border-solid border-[rgba(0,0,0,0.04)] shadow-[inset_0px_-2px_4px_0px_rgba(0,0,0,0.08),inset_0px_2px_4px_0px_rgba(255,255,255,0.48)] ${
              alreadyAdded
                ? 'bg-[#f6f1ee] text-[#caa79b]'
                : 'bg-[#f7ae4b] text-[#561517] hover:bg-[#f7ae4b]/90'
            }`}
            onClick={handleAdd}
            disabled={alreadyAdded}
          >
            {alreadyAdded ? (
              '✓'
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[clamp(12px,3vw,16px)] h-[clamp(12px,3vw,16px)]"
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
}
