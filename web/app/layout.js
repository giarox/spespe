import Image from 'next/image'
import { Instrument_Serif, Vend_Sans } from "next/font/google";
import { ShoppingListProvider } from '@/components/ShoppingListContext'
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
        <header className="px-6 pt-8">
          <div className="mx-auto w-full max-w-5xl rounded-[32px] bg-[#fbe8d8] px-6 py-8 shadow-[0_20px_60px_rgba(154,115,96,0.2)]">
            <div className="flex items-center gap-4">
              <Image src="/aspe-logo.svg" alt="Aspè" width={48} height={48} priority />
              <div>
                <p className="text-xl font-semibold text-[#f16b6b]">Aspè!</p>
                <p className="text-xs text-[#b18474]">Offerte da supermercati italiani</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="min-h-screen px-6 pb-16 pt-6">
          {children}
        </main>
        
        <footer className="px-6 pb-8">
          <div className="mx-auto w-full max-w-5xl rounded-[32px] bg-[#fbe8d8] px-6 py-6 text-center text-sm text-[#b18474]">
            Aggiornato ogni lunedì alle 9:00 · Dati estratti automaticamente dai volantini digitali
          </div>
        </footer>
        </ShoppingListProvider>
      </body>
    </html>
  );
}
