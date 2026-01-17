"use client"

import { Input } from '@/components/ui/input'

export default function SearchBar({ value, onChange }) {
  return (
    <div className="w-full md:max-w-sm">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cerca prodotto o brand"
        className="bg-white"
      />
      <p className="mt-1 text-xs text-gray-500">
        Risultati in tempo reale mentre digiti
      </p>
    </div>
  )
}
