import { Instrument_Serif, Vend_Sans } from "next/font/google";
import { ShoppingListProvider } from '@/components/ShoppingListContext'
import AspeLogo from '@/components/AspeLogo'
import "./globals.css";

const vendSans = Vend_Sans({
  variable: "--font-vend-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  fallback: ["system-ui", "sans-serif"]
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"]
});

export const metadata = {
  title: "Spespe - Offerte Supermercati",
  description: "Le migliori offerte dei supermercati italiani - Lidl, Conad, Esselunga",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5
}

export const themeColor = "#3b82f6"

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className={`${vendSans.variable} ${instrumentSerif.variable} antialiased bg-[#f6f1ee] text-[#6d4b42]`}>
        <ShoppingListProvider>
        <header className="px-6 pt-12 pb-4">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-center gap-2">
              <AspeLogo className="w-8 h-8" />
              <span className="text-2xl font-bold tracking-tight text-[#f16b6b]">Aspè!</span>
            </div>
          </div>
        </header>
        
        <main className="min-h-[70vh] px-6 pb-16 pt-8">
          {children}
        </main>
        
        <footer className="px-6 pb-12">
          <div className="mx-auto w-full max-w-5xl border-t border-[#e5deda] pt-8 text-sm text-[#b18474]">
            Aggiornato ogni lunedì alle 9:00 · Dati estratti automaticamente dai volantini digitali
          </div>
        </footer>
        </ShoppingListProvider>
      </body>
    </html>
  );
}
