import SearchExperience from '@/components/SearchExperience'

export const revalidate = 3600 // Revalidate every hour

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const searchQuery = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const title = searchQuery ? `Risultati per “${searchQuery}”` : 'Aspè! Controlla le offerte prima di fare la spesa!'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-16">
      <div>
        <h1 className="font-serif text-5xl md:text-6xl italic text-[#6d4b42] leading-[1.15] max-w-3xl">
          {title}
        </h1>
        <div className="mt-12">
          <SearchExperience initialQuery={searchQuery} />
        </div>
      </div>
    </div>
  )
}

