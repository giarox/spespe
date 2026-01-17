"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'

const buildQueryString = (query) => {
  if (!query) {
    return ''
  }
  const params = new URLSearchParams({ q: query })
  return `?${params.toString()}`
}

export default function SearchBar({ initialQuery = '' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)

  const normalizedValue = useMemo(() => value.trim(), [value])

  useEffect(() => {
    const handle = setTimeout(() => {
      const nextQuery = buildQueryString(normalizedValue)
      const currentQuery = buildQueryString(searchParams.get('q')?.trim() || '')

      if (nextQuery !== currentQuery) {
        router.replace(nextQuery || '/', { scroll: false })
      }
    }, 200)

    return () => clearTimeout(handle)
  }, [normalizedValue, router, searchParams])

  return (
    <div className="w-full md:max-w-sm">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cerca prodotto o brand"
        className="bg-white"
      />
      <p className="mt-1 text-xs text-gray-500">
        Risultati in tempo reale mentre digiti
      </p>
    </div>
  )
}
