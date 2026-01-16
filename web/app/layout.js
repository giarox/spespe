import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Spespe - Offerte Supermercati",
  description: "Le migliori offerte dei supermercati italiani - Lidl, Conad, Esselunga",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  themeColor: "#3b82f6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}>
        {/* Mobile-optimized header */}
        <header className="bg-white shadow-sm sticky top-0 z-50 border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-blue-600">
              🛒 Spespe
            </h1>
            <p className="text-xs text-gray-500">
              Trova le migliori offerte
            </p>
          </div>
        </header>
        
        <main className="min-h-screen">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="bg-white border-t mt-12 py-6">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-600">
              Aggiornato ogni lunedì alle 9:00
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Dati estratti automaticamente dai volantini digitali
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
