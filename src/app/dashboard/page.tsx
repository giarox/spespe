import Link from "next/link";
import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabase/server";
import { fetchLatestOffers } from "@/lib/data/offers";

export default async function DashboardPage() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const offers = await fetchLatestOffers();

  return (
    <main className="p-6 space-y-6">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-gray-500">Hi</p>
        <h1 className="text-3xl font-semibold">{user.email ?? "Friend"}</h1>
        <p className="text-gray-700">Here are the freshest offers near Milano.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Latest offers</h2>
        {offers.length === 0 ? (
          <p className="text-gray-500 text-sm">No offers yet. They’ll appear as soon as we ingest flyers.</p>
        ) : (
          <ul className="space-y-4">
            {offers.map((offer) => (
              <li key={offer.id} className="rounded border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium">{offer.product?.name}</p>
                    <p className="text-sm text-gray-600">{offer.product?.brand}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">€{offer.price.toFixed(2)}</p>
                    {offer.original_price && (
                      <p className="text-xs text-gray-500 line-through">€{offer.original_price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {offer.store?.name} — {offer.store?.address}
                  {offer.store?.chain?.name && <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded">{offer.store.chain.name}</span>}
                </div>
                <div className="text-xs text-gray-500">
                  Valido {offer.valid_from ?? "?"} → {offer.valid_to ?? "?"}
                </div>
                {offer.source_url && (
                  <a
                    className="text-sm underline"
                    href={offer.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Vedi volantino
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-sm">
        <Link className="underline" href="/">
          ← Back home
        </Link>
      </div>
    </main>
  );
}
