import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createServer } from "@/lib/supabase/server";

type FlyerDetail = {
  id: string;
  viewer_url: string | null;
  period_start: string | null;
  period_end: string | null;
  fetched_at: string;
  chain: { name: string | null } | { name: string | null }[] | null;
  flyer_pages: Array<{
    page_no: number;
    image_url: string;
    width: number | null;
    height: number | null;
  }> | null;
};

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return "Date non disponibili";
  const fmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });
  if (start && end) {
    return `${fmt.format(new Date(start))} → ${fmt.format(new Date(end))}`;
  }
  if (start) return `Dal ${fmt.format(new Date(start))}`;
  return `Fino al ${fmt.format(new Date(end!))}`;
}

export default async function FlyerDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("flyers")
    .select(
      "id, viewer_url, period_start, period_end, fetched_at, chain:chains(name), flyer_pages(page_no, image_url, width, height)"
    )
    .eq("id", params.id)
    .order("page_no", { ascending: true, foreignTable: "flyer_pages" })
    .maybeSingle();

  if (error) {
    console.error("Failed to load flyer", error);
    throw new Error("Impossibile caricare il volantino");
  }

  if (!data) {
    notFound();
  }

  const flyer = data as FlyerDetail;
  const chainData = Array.isArray(flyer.chain) ? flyer.chain[0] : flyer.chain;
  const pages = [...(flyer.flyer_pages ?? [])].sort((a, b) => a.page_no - b.page_no);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm">
          <Link href="/flyers" className="text-gray-600 underline">
            ← Torna ai volantini
          </Link>
        </p>
        <h1 className="text-3xl font-bold">{chainData?.name ?? "Volantino"}</h1>
        <p className="text-gray-600">
          {formatRange(flyer.period_start, flyer.period_end)} · Caricato il{" "}
          {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(flyer.fetched_at))}
        </p>
        {flyer.viewer_url && (
          <a
            href={flyer.viewer_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm underline"
          >
            Apri viewer Lidl
          </a>
        )}
      </header>

      {pages.length === 0 ? (
        <p className="text-sm text-gray-500">Pagine non ancora disponibili per questo volantino.</p>
      ) : (
        <div className="space-y-8">
          {pages.map((page) => (
            <article key={page.page_no} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold">Pagina {page.page_no}</h2>
                <span className="text-xs text-gray-500">
                  {page.width && page.height ? `${page.width} × ${page.height} px` : "dimensioni n/d"}
                </span>
              </div>
              <div className="overflow-hidden rounded border bg-white shadow-sm">
                <div className="relative mx-auto w-full max-w-3xl">
                  <Image
                    src={page.image_url}
                    alt={`Volantino pagina ${page.page_no}`}
                    width={page.width ?? 1200}
                    height={page.height ?? 1600}
                    className="w-full rounded-sm bg-white"
                    unoptimized
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
