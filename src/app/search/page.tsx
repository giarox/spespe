"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SortMode = "mixed" | "price" | "distance";

type SearchOffer = {
  id: string;
  store_id: string | null;
  chain_id: string;
  chain_name: string | null;
  product_name: string;
  brand: string | null;
  category: string | null;
  price: number;
  original_price: number | null;
  discount_type: string | null;
  discount_value: number | null;
  valid_from: string | null;
  valid_to: string | null;
  unit: string | null;
  unit_price: number | null;
  image_url: string | null;
  source_url: string | null;
  sku: string | null;
  store_name: string | null;
  store_address: string | null;
  store_city: string | null;
  d_km: number | null;
  score: number | null;
};

const SORT_LABELS: Record<SortMode, string> = {
  mixed: "Prezzo + distanza",
  price: "Solo prezzo",
  distance: "Solo distanza",
};

const RADIUS_OPTIONS = [5, 10, 20, 30];

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const [offers, setOffers] = useState<SearchOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState("tutte");
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<SortMode>("mixed");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "manual">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      setLoadingOffers(true);
      const { data, error } = await supabase.rpc("rpc_search_offers", {
        q: query.trim() !== "" ? query.trim() : null,
        ul_lat: coords?.lat ?? null,
        ul_lon: coords?.lon ?? null,
        mode: sortMode,
        radius_km: coords ? radiusKm : null,
        chain_filter: null,
      });
      if (error) {
        console.error(error);
        setOffers([]);
      } else {
        setOffers((data ?? []) as SearchOffer[]);
      }
      setLoadingOffers(false);
    }
    loadOffers();
  }, [supabase, query, coords, sortMode, radiusKm]);

  const chainOptions = useMemo(() => {
    const names = new Set<string>();
    offers.forEach((offer) => {
      if (offer.chain_name) {
        names.add(offer.chain_name);
      }
    });
    return Array.from(names);
  }, [offers]);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (chainFilter !== "tutte" && offer.chain_name !== chainFilter) {
        return false;
      }
      return true;
    });
  }, [offers, chainFilter]);

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Il tuo browser non supporta la geolocalizzazione.");
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("requesting");
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus("granted");
      },
      (err) => {
        console.warn(err);
        setLocationError("Non possiamo accedere alla tua posizione. Puoi inserirla manualmente.");
        setLocationStatus("denied");
      },
      { enableHighAccuracy: true }
    );
  }

  const showManualCard = locationStatus === "manual" || locationStatus === "denied";

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Cerca offerte vicine</h1>
        <p className="text-gray-600">Trova i volantini della settimana e ordina per prezzo o distanza.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-medium text-gray-700">Cosa stai cercando?</label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Latte, pasta, biscotti..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Catena</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
          >
            <option value="tutte">Tutte le catene</option>
            {chainOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Raggio massimo</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            disabled={!coords}
          >
            {RADIUS_OPTIONS.map((km) => (
              <option key={km} value={km}>
                Fino a {km} km
              </option>
            ))}
          </select>
          {!coords && <p className="text-xs text-gray-500">Attiva la posizione per filtrare per distanza.</p>}
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Ordina per</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <button
                key={mode}
                className={`rounded border px-3 py-2 text-sm ${sortMode === mode ? "bg-black text-white" : ""}`}
                type="button"
                onClick={() => setSortMode(mode)}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(locationStatus === "idle" || locationStatus === "requesting") && (
        <section className="rounded border p-4 space-y-2">
          <h2 className="text-lg font-semibold">Vuoi usare la tua posizione?</h2>
          <p className="text-sm text-gray-600">
            Serve solo per calcolare la distanza. Non salviamo nulla: la tua posizione rimane sul tuo dispositivo.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="rounded bg-black text-white px-4 py-2 text-sm"
              onClick={requestLocation}
              disabled={locationStatus === "requesting"}
            >
              {locationStatus === "requesting" ? "Sto chiedendo al browser..." : "Usa la posizione del browser"}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              onClick={() => setLocationStatus("manual")}
            >
              Preferisco inserirla
            </button>
          </div>
        </section>
      )}

      {showManualCard && (
        <section className="rounded border p-4 space-y-2">
          <h2 className="text-lg font-semibold">Inserisci il tuo indirizzo</h2>
          <p className="text-sm text-gray-600">Per ora lo usiamo solo come riferimento testuale.</p>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Via, città"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
          />
        </section>
      )}
      {locationError && <p className="text-sm text-red-600">{locationError}</p>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Risultati</h2>
          <p className="text-sm text-gray-600">
            {loadingOffers ? "Caricamento..." : `${filteredOffers.length} offerte trovate`}
          </p>
        </div>
        {filteredOffers.length === 0 && !loadingOffers ? (
          <p className="text-gray-500 text-sm">Nessuna offerta corrisponde ai filtri. Ritenta allargando la ricerca.</p>
        ) : (
          <ul className="space-y-4">
            {filteredOffers.map((offer) => (
              <li key={offer.id} className="rounded border p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-medium">{offer.product_name}</p>
                    <p className="text-sm text-gray-600">{offer.brand}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">€{offer.price.toFixed(2)}</p>
                    {offer.original_price && (
                      <p className="text-xs text-gray-500 line-through">€{offer.original_price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 flex flex-wrap gap-2 items-center">
                  <span>{offer.store_name ?? "Negozio"}</span>
                  {offer.store_address && <span>· {offer.store_address}</span>}
                  {offer.chain_name && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">{offer.chain_name}</span>
                  )}
                  {offer.d_km != null && (
                    <span className="text-xs text-gray-500">{offer.d_km.toFixed(1)} km</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Valido {offer.valid_from ?? "?"} → {offer.valid_to ?? "?"}
                </div>
                {offer.source_url && (
                  <a className="text-sm underline" href={offer.source_url} target="_blank" rel="noreferrer">
                    Apri volantino
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
