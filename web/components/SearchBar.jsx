"use client"

import { Input } from '@/components/ui/input'

export default function SearchBar({ value, onChange }) {
  return (
    <div className="w-full">
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Cerca prodotto o marca..."
        className="h-14 rounded-full border-transparent bg-white/90 px-6 text-lg text-[#6d4b42] placeholder:text-[#d3b4a8] shadow-[0_12px_30px_rgba(154,115,96,0.12)]"
      />
    </div>
  )
}
