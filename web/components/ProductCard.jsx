import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        {product.discount_percent && (
          <Badge variant="destructive" className="mb-2">
            {product.discount_percent}
          </Badge>
        )}
        <h3 className="text-lg font-semibold leading-tight">
          {product.product_name}
        </h3>
        {product.brand && (
          <p className="text-sm text-muted-foreground">{product.brand}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${hasDiscount ? 'text-green-600' : 'text-gray-900'}`}>
              {formattedCurrent}
            </span>
            {formattedOld && (
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                Prima
              </span>
            )}
          </div>
          {formattedOld ? (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span className="line-through">
                {formattedOld}
              </span>
              {formattedSaving && (
                <span className="text-xs font-semibold text-emerald-600">
                  Risparmi {formattedSaving}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Prezzo corrente</p>
          )}
        </div>
        {product.weight_or_pack && (
          <p className="text-sm text-gray-600 mb-1">
            {product.weight_or_pack}
          </p>
        )}
        {product.price_per_unit && (
          <p className="text-xs text-gray-500">
            {product.price_per_unit}
          </p>
        )}
        {product.notes && product.notes.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            {product.notes.map((note, idx) => (
              <p key={idx} className="text-xs text-blue-600 italic">
                ℹ️ {note}
              </p>
            ))}
          </div>
        )}
        <Button className="w-full mt-3" size="lg">
          Aggiungi alla Lista
        </Button>
      </CardContent>
    </Card>
  )
}
