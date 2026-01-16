import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ProductCard({ product }) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price)
  }
  
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        {/* Discount badge */}
        {product.discount_percent && (
          <Badge variant="destructive" className="mb-2">
            {product.discount_percent}
          </Badge>
        )}
        
        {/* Product name */}
        <h3 className="text-lg font-semibold leading-tight">
          {product.product_name}
        </h3>
        
        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-muted-foreground">{product.brand}</p>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Price display */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold text-green-600">
            {formatPrice(product.current_price)}
          </span>
          {product.old_price && (
            <span className="text-lg text-gray-400 line-through">
              {formatPrice(product.old_price)}
            </span>
          )}
        </div>
        
        {/* Weight/pack */}
        {product.weight_or_pack && (
          <p className="text-sm text-gray-600 mb-1">
            {product.weight_or_pack}
          </p>
        )}
        
        {/* Price per unit */}
        {product.price_per_unit && (
          <p className="text-xs text-gray-500">
            {product.price_per_unit}
          </p>
        )}
        
        {/* Notes (Italian claims) */}
        {product.notes && product.notes.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            {product.notes.map((note, idx) => (
              <p key={idx} className="text-xs text-blue-600 italic">
                ℹ️ {note}
              </p>
            ))}
          </div>
        )}
        
        {/* Add to list button */}
        <Button className="w-full mt-3" size="lg">
          Aggiungi alla Lista
        </Button>
      </CardContent>
    </Card>
  )
}
