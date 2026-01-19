"use client"

import { Input } from '@/components/ui/input'

export default function SearchBar({ value, onChange }) {
  return (
    <div className="w-full max-w-2xl">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cerca prodotto o marca..."
        className="h-16 rounded-full border-none bg-white px-8 text-xl text-[#6d4b42] placeholder:text-[#caa79b] shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  )
}
