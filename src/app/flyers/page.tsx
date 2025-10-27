import Link from "next/link";
import Image from "next/image";
import { createServer } from "@/lib/supabase/server";

type FlyerWithPages = {
  id: string;
  viewer_url: string | null;
  fetched_at: string;
  period_start: string | null;
  period_end: string | null;
  chain: { name: string | null } | { name: string | null }[] | null;
  flyer_pages: Array<{
    page_no: number;
    image_url: string;
    width: number | null;
    height: number | null;
  }> | null;
};

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" };
  const fmt = new Intl.DateTimeFormat("it-IT", opts);
  if (start && end) {
    return `${fmt.format(new Date(start))} → ${fmt.format(new Date(end))}`;
  }
  if (start) return `Dal ${fmt.format(new Date(start))}`;
  if (end) return `Fino al ${fmt.format(new Date(end))}`;
  return null;
}

export default async function FlyersPage() {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("flyers")
    .select(
      "id, viewer_url, fetched_at, period_start, period_end, chain:chains(name), flyer_pages(page_no, image_url, width, height)"
    )
    .order("fetched_at", { ascending: false })
    .order("page_no", { ascending: true, foreignTable: "flyer_pages" })
    .limit(6);

  if (error) {
    console.error("Failed to load flyers", error);
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Volantini</h1>
          <p className="text-gray-600">
            Non riusciamo a caricare i volantini in questo momento. Riprova più tardi.
          </p>
        </header>
      </main>
    );
  }

  const flyers = (data ?? []) as FlyerWithPages[];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Ultimi volantini</h1>
        <p className="text-gray-600">
          Ogni pagina è presa dal viewer ufficiale Lidl a 2400px. Clicca su un volantino per aprire tutti i dettagli.
        </p>
      </header>

      {flyers.length === 0 ? (
        <p className="text-sm text-gray-500">Nessun volantino disponibile al momento.</p>
      ) : (
        <div className="space-y-8">
          {flyers.map((flyer) => {
            const chainData = Array.isArray(flyer.chain) ? flyer.chain[0] : flyer.chain;
            const range = formatDateRange(flyer.period_start, flyer.period_end);
            const pages = [...(flyer.flyer_pages ?? [])].sort((a, b) => a.page_no - b.page_no);
            return (
              <section key={flyer.id} className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-2xl font-semibold">
                      {chainData?.name ?? "Volantino"} · {range ?? "date non disponibili"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      Caricato il {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(flyer.fetched_at))}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm">
                    {flyer.viewer_url && (
                      <a
                        href={flyer.viewer_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border px-3 py-1 hover:bg-gray-50"
                      >
                        Apri viewer originale
                      </a>
                    )}
                    <Link
                      href={`/flyers/${flyer.id}`}
                      className="rounded border px-3 py-1 hover:bg-gray-50"
                    >
                      Dettagli
                    </Link>
                  </div>
                </div>

                {pages.length === 0 ? (
                  <p className="text-sm text-gray-500">Pagine non ancora disponibili.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {pages.slice(0, 4).map((page) => (
                      <div key={page.page_no} className="overflow-hidden rounded border bg-white shadow-sm">
                        <div className="relative aspect-[3/4]">
                          <Image
                            src={page.image_url}
                            alt={`Pagina ${page.page_no}`}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                            priority={false}
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-600">
                          <span>Pagina {page.page_no}</span>
                          <span>
                            {page.width && page.height ? `${page.width}×${page.height}` : "dimensioni n/d"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
