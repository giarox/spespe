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
    <Card
      className={`w-full overflow-hidden rounded-[24px] bg-white p-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 ${
        isAdding ? 'scale-[1.02]' : ''
      }`}
    >
      <CardContent className="flex h-[110px] items-start gap-[12px] p-0">
        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-[#0050AA]">
            <div className="h-[6px] w-full bg-[#FFF000]" />
            <div className="flex flex-1 items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="px-[4px] py-[6px] text-center text-[8px] font-black tracking-tight text-white">
                  {product.supermarket}
                </span>
              )}
            </div>
            <div className="h-[6px] w-full bg-[#E60A14]" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold leading-tight text-[#71393B]">
                {formattedName}
              </h3>
              {formattedBrand && (
                <p className="truncate text-[12px] font-normal text-[#71393B]/70">{formattedBrand}</p>
              )}
            </div>
            {displayDiscount && (
              <span className="shrink-0 rounded-full bg-[#FA7272] px-[12px] text-[12px] font-bold leading-[24px] text-white">
                {displayDiscount}
              </span>
            )}
          </div>

            <div className="flex items-end justify-between gap-[12px]">
              <div className="flex items-baseline gap-[8px]">
                <span className="text-[24px] font-semibold text-[#E36E4B]">
                  {formattedCurrent}
                </span>
                {formattedOld && (
                  <span className="text-[16px] font-normal text-[#71393B]/40 line-through decoration-1">
                    {formattedOld}
                  </span>
                )}
              </div>
              <Button
                aria-label={alreadyAdded ? 'Aggiunto alla Lista' : 'Aggiungi alla Lista'}
                className={`h-[32px] shrink-0 rounded-full px-[16px] text-[16px] font-medium transition-all duration-300 ${
                  alreadyAdded
                    ? 'bg-[#f6f1ee] text-[#caa79b]'
                    : 'bg-[#FCBE69] text-[#71393B] shadow-[0_8px_16px_rgba(252,190,105,0.35)] hover:bg-[#f5b35a] active:scale-95'
                }`}
                onClick={handleAdd}
                disabled={alreadyAdded}
              >
                {alreadyAdded ? (
                  '✓'
                ) : (
                  <span className="flex items-center gap-[8px]">
                    Aggiungi
                    <svg
                      aria-hidden="true"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="shrink-0"
                    >
                      <path
                        d="M7.5 6H4L2 14.5C1.8 15.4 2.5 16.3 3.5 16.3H17.6C18.4 16.3 19.2 15.7 19.4 14.9L21.3 7.5H7.5Z"
                        stroke="#71393B"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.5 19.5C9.5 20.3 8.8 21 8 21C7.2 21 6.5 20.3 6.5 19.5C6.5 18.7 7.2 18 8 18C8.8 18 9.5 18.7 9.5 19.5Z"
                        fill="#71393B"
                      />
                      <path
                        d="M17.5 19.5C17.5 20.3 16.8 21 16 21C15.2 21 14.5 20.3 14.5 19.5C14.5 18.7 15.2 18 16 18C16.8 18 17.5 18.7 17.5 19.5Z"
                        fill="#71393B"
                      />
                    </svg>
                  </span>
                )}
              </Button>
            </div>


          {metaLine && (
            <div className="text-[8px] font-normal text-[#71393B]/50">
              {metaLine}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

