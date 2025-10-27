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
          Qui trovi gli ultimi volantini rilevati con i relativi metadati. Per il contenuto completo apri il viewer
          ufficiale di Lidl: le immagini restano ospitate sui loro server e non vengono cache-ate da Spespe.
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
                    <p className="text-xs text-gray-500">
                      Pagine indicizzate: {(flyer.flyer_pages ?? []).length || "n/d"}
                    </p>
                    {flyer.viewer_url && (
                      <p className="text-xs text-gray-400 break-all">
                        URL viewer: {flyer.viewer_url}
                      </p>
                    )}
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
                  </div>
                </div>

                {pages.length > 0 ? (
                  <div className="rounded border bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
                    <p className="font-medium text-gray-700">Pagine rilevate</p>
                    <ul className="mt-2 flex flex-wrap gap-3">
                      {pages.map((page) => (
                        <li key={page.page_no} className="rounded bg-gray-100 px-2 py-1">
                          Pagina {page.page_no}{" "}
                          <span className="text-xs text-gray-500">
                            {page.width && page.height ? `${page.width}×${page.height}px` : "dim. n/d"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Pagine non ancora disponibili.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
