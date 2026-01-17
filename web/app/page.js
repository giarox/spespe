import SearchBar from '@/components/SearchBar'
import ProductsGrid from '@/components/ProductsGrid'

export const revalidate = 3600 // Revalidate every hour

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const searchQuery = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const title = searchQuery ? `Risultati per “${searchQuery}”` : '🛒 Offerte Lidl'

  return (
    <div className="container mx-auto p-4 pb-20">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {title}
          </h1>
          <p className="text-gray-600 mt-2">
            Cerca tra prodotti e brand in tempo reale
          </p>
        </div>
        <SearchBar initialQuery={searchQuery} />
      </div>
      
      <ProductsGrid searchQuery={searchQuery} />
    </div>
  )
}

