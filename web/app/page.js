import { supabase } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'

export const revalidate = 3600 // Revalidate every hour

export default async function Home() {
  // Fetch products from Supabase
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('supermarket', 'Lidl')
    .order('discount_percent', { ascending: false, nullsFirst: false })
  
  if (error) {
    console.error('Failed to fetch products:', error)
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-600">
          Errore nel caricamento delle offerte
        </h1>
        <p className="mt-2 text-gray-600">
          Riprova più tardi. Errore: {error.message}
        </p>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto p-4 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          🛒 Offerte Lidl
        </h1>
        <p className="text-gray-600 mt-2">
          {products?.length || 0} prodotti in offerta questa settimana
        </p>
      </div>
      
      {/* Product grid */}
      {products && products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-400">
            Nessuna offerta disponibile
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Controlla di nuovo lunedì per le nuove offerte
          </p>
        </div>
      )}
    </div>
  )
}
