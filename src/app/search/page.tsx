"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OfferWithRelations } from "@/lib/supabase/types";
import { haversineKm } from "@/lib/geo";

type SortMode = "blended" | "price" | "distance";
type OfferView = OfferWithRelations & { distanceKm: number | null };

const SORT_LABELS: Record<SortMode, string> = {
  blended: "Prezzo + distanza",
  price: "Solo prezzo",
  distance: "Solo distanza",
};

const RADIUS_OPTIONS = [5, 10, 20, 30];

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const [offers, setOffers] = useState<OfferWithRelations[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [query, setQuery] = useState("");
  const [chainFilter, setChainFilter] = useState("tutte");
  const [radiusKm, setRadiusKm] = useState(10);
  const [sortMode, setSortMode] = useState<SortMode>("blended");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "manual">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      setLoadingOffers(true);
      const { data, error } = await supabase
        .from("offers")
        .select(
          `*, product:products(*), store:stores(*, chain:chains(*))`
        )
        .order("created_at", { ascending: false });
      if (error) {
        console.error(error);
        setOffers([]);
      } else {
        setOffers((data ?? []) as OfferWithRelations[]);
      }
      setLoadingOffers(false);
    }
    loadOffers();
  }, [supabase]);

  const chainOptions = useMemo(() => {
    const names = new Set<string>();
    offers.forEach((offer) => {
      if (offer.store?.chain?.name) {
        names.add(offer.store.chain.name);
      }
    });
    return Array.from(names);
  }, [offers]);

  const offersWithDistance = useMemo<OfferView[]>(() => {
    return offers.map((offer) => {
      const storeLat = offer.store?.lat;
      const storeLon = offer.store?.lon;
      const distanceKm =
        coords && typeof storeLat === "number" && typeof storeLon === "number"
          ? haversineKm(coords, { lat: storeLat, lon: storeLon })
          : null;
      return { ...offer, distanceKm };
    });
  }, [offers, coords]);

  const filteredOffers = useMemo(() => {
    return offersWithDistance
      .filter((offer) => {
        if (query && !offer.product?.name?.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        if (chainFilter !== "tutte" && offer.store?.chain?.name !== chainFilter) {
          return false;
        }
        if (coords && offer.distanceKm != null && offer.distanceKm > radiusKm) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortMode === "price") {
          return a.price - b.price;
        }
        if (sortMode === "distance") {
          return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
        }
        const aScore = a.price + (a.distanceKm ?? radiusKm);
        const bScore = b.price + (b.distanceKm ?? radiusKm);
        return aScore - bScore;
      });
  }, [offersWithDistance, query, chainFilter, coords, radiusKm, sortMode]);

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
                <div className="text-sm text-gray-600 flex flex-wrap gap-2 items-center">
                  <span>{offer.store?.name}</span>
                  {offer.store?.address && <span>· {offer.store.address}</span>}
                  {offer.store?.chain?.name && (
                    <span className="px-2 py-0.5 text-xs bg-gray-100 rounded">{offer.store.chain.name}</span>
                  )}
                  {offer.distanceKm != null && (
                    <span className="text-xs text-gray-500">{offer.distanceKm.toFixed(1)} km</span>
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
