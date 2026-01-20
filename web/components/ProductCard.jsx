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
      <CardContent className="flex py-4 px-3">
        <div className="flex-shrink-0">
          <div className="w-[32px] h-[32px] rounded-[6px] flex items-center justify-center" style={{ background: logoUrl ? 'transparent' : 'linear-gradient(180deg, #FFF000 0%, #FFF000 33%, #E60A14 33%, #E60A14 66%, #0050AA 66%, #0050AA 100%)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain p-[4px]" />
            ) : (
              <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">
                {product.supermarket}
              </span>
            )}
          </div>
        </div>
        <div className="w-[16px]" />
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-['Vend_Sans:SemiBold',sans-serif] text-[18px] leading-[26px] text-[#561517] font-semibold truncate">
                {formattedName}
              </h3>
              {formattedBrand && (
                <p className="font-['Vend_Sans:Regular',sans-serif] text-[16px] leading-[20px] text-[rgba(113,57,59,0.72)] font-normal mt-[2px]">
                  {formattedBrand}
                </p>
              )}
            </div>
            {displayDiscount && (
              <div className="ml-2 flex-shrink-0 bg-[#e36e4b] text-white text-[14px] font-bold px-[8px] py-[4px] rounded-[8px] border border-solid border-[rgba(255,255,255,0.08)] shadow-[inset_0px_2px_4px_0px_rgba(255,255,255,0.12)]">
                <span className="uppercase tracking-wider font-['Vend_Sans:Bold',sans-serif]">
                  {displayDiscount}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-[8px]">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-[6px]">
                <span className="font-['Vend_Sans:SemiBold',sans-serif] text-[24px] leading-[32px] text-[#e36e4b] font-semibold">
                  {formattedCurrent}
                </span>
                {formattedOld && (
                  <span className="font-['Vend_Sans:Regular',sans-serif] text-[16px] text-[rgba(113,57,59,0.4)] font-normal line-through decoration-solid">
                    {formattedOld}
                  </span>
                )}
              </div>
              {metaLine && (
                <p className="font-['Vend_Sans:Regular',sans-serif] text-[12px] leading-[12px] text-[rgba(113,57,59,0.64)] font-normal mt-[2px]">
                  {metaLine}
                </p>
              )}
              {Array.isArray(product.notes) && product.notes.length > 0 && (
                <p className="font-['Vend_Sans:Regular',sans-serif] text-[12px] leading-[12px] text-[rgba(113,57,59,0.64)] font-normal mt-[2px] italic">
                  {product.notes.join(', ')}
                </p>
              )}
            </div>
            <Button
              aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
              className={`flex-shrink-0 h-[48px] w-[48px] font-['Vend_Sans:Bold',sans-serif] text-[14px] font-bold rounded-[12px] border border-solid border-[rgba(0,0,0,0.04)] shadow-[inset_0px_-2px_4px_0px_rgba(0,0,0,0.08),inset_0px_2px_4px_0px_rgba(255,255,255,0.48)] ${
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
                <>
                  Aggiungi
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-[14px] h-[14px] ml-[6px]"
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
