import SearchExperience from '@/components/SearchExperience'

export const revalidate = 3600 // Revalidate every hour

export default async function Home({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const searchQuery = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q.trim() : ''
  const title = searchQuery ? `Risultati per “${searchQuery}”` : 'Aspè! Controlla le offerte prima di fare la spesa!'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10">
      <div className="rounded-[32px] bg-[#fbe8d8] px-6 py-10 shadow-[0_20px_60px_rgba(154,115,96,0.16)]">
        <h1 className="font-serif text-3xl md:text-4xl italic text-[#6d4b42]">
          {title}
        </h1>
        <div className="mt-6">
          <SearchExperience initialQuery={searchQuery} />
        </div>
      </div>
    </div>
  )
}

