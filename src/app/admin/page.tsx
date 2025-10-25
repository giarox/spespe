import Link from "next/link";
import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabase/server";

type ChainSummary = { chain: string; count: number };

export default async function AdminPage() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  const [offerCountRes, storeCountRes, listItemCountRes] = await Promise.all([
    supabase.from("offers").select("id", { count: "exact", head: true }),
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("list_items").select("id", { count: "exact", head: true }),
  ]);

  const offerCount = offerCountRes.count ?? 0;
  const storeCount = storeCountRes.count ?? 0;
  const listItemCount = listItemCountRes.count ?? 0;

  const { data: offersByChain } = await supabase
    .from("offers")
    .select("id, chain:chains(name)")
    .limit(2000);

  const chainSummary = (offersByChain ?? []).reduce((acc: ChainSummary[], row) => {
    const chainData = Array.isArray(row.chain) ? row.chain[0] : row.chain;
    const label = chainData?.name ?? "Sconosciuta";
    const existing = acc.find((entry) => entry.chain === label);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ chain: label, count: 1 });
    }
    return acc;
  }, [] as ChainSummary[]).sort((a, b) => b.count - a.count);

  const { data: latestOffers } = await supabase
    .from("offers")
    .select("id, product_name, brand, price, valid_to, chain:chains(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-gray-600">Uno sguardo rapido su cosa sta succedendo nello scraping e nell&apos;app.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Offerte totali</p>
          <p className="text-3xl font-semibold">{offerCount}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Negozi con coordinate</p>
          <p className="text-3xl font-semibold">{storeCount}</p>
        </div>
        <div className="rounded border p-4">
          <p className="text-sm text-gray-500">Articoli salvati nelle liste</p>
          <p className="text-3xl font-semibold">{listItemCount}</p>
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Offerte per catena</h2>
          <p className="text-sm text-gray-500">Prime 5 catene</p>
        </div>
        {chainSummary.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun dato disponibile.</p>
        ) : (
          <ul className="space-y-2">
            {chainSummary.slice(0, 5).map((entry) => (
              <li key={entry.chain} className="flex items-center justify-between text-sm">
                <span>{entry.chain}</span>
                <span className="font-semibold">{entry.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">Ultime offerte inserite</h2>
        {latestOffers?.length ? (
          <ul className="space-y-2">
            {latestOffers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{offer.product_name ?? "Prodotto"}</p>
                  <p className="text-gray-500">{offer.brand}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">€{offer.price?.toFixed(2) ?? "0.00"}</p>
                  <p className="text-xs text-gray-500">
                    {(() => {
                      const chainData = Array.isArray(offer.chain) ? offer.chain[0] : offer.chain;
                      return chainData?.name ?? "Catena";
                    })()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nessuna offerta caricata.</p>
        )}
      </section>

      <section className="rounded border p-4 space-y-2">
        <h2 className="text-xl font-semibold">Prossimi passi</h2>
        <p className="text-sm text-gray-600">Avvia il crawler manuale per popolare nuove offerte oppure controlla i log su GitHub Actions.</p>
        <Link className="text-sm underline" href="/search">
          Torna alla ricerca →
        </Link>
      </section>
    </main>
  );
}
