import Link from "next/link";
import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabase/server";

export default async function ListaPage() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?redirect=/lista");
  }

  await supabase.from("users").upsert({ id: user.id, email: user.email }, { onConflict: "id" });

  let listId: string | null = null;
  const { data: existingList } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingList?.id) {
    listId = existingList.id;
  } else {
    const { data: newList } = await supabase
      .from("lists")
      .insert({ user_id: user.id })
      .select("id, name")
      .single();
    listId = newList?.id ?? null;
  }

  const { data: items } = await supabase
    .from("list_items")
    .select(
      `id, qty,
        offer:offers(
          id,
          price,
          original_price,
          source_url,
          product:products(name, brand),
          store:stores(name, address),
          chain:chains(name)
        )`
    )
    .eq("list_id", listId);

  type ListItemRow = {
    id: string;
    qty: number | null;
    offer: {
      id: string;
      price: number | null;
      product: { name: string | null; brand: string | null } | null;
      store: { name: string | null; address: string | null } | null;
    } | null;
  };

  const typedItems = ((items ?? []) as unknown) as ListItemRow[];

  const grouped = typedItems.reduce((acc: Record<string, ListItemRow[]>, item) => {
    const key = item.offer?.store?.name ?? "Negozi";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ListItemRow[]>);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">La mia lista</h1>
        <p className="text-gray-600">Raggruppiamo per negozio così puoi pianificare il giro spesa.</p>
      </header>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-gray-500">
          Lista vuota. Torna alla <Link className="underline" href="/search">ricerca</Link> e aggiungi qualche offerta.
        </p>
      ) : (
        Object.entries(grouped).map(([storeName, storeItems]) => (
          <section key={storeName} className="space-y-2 rounded border p-4">
            <div>
              <h2 className="text-xl font-semibold">{storeName}</h2>
              <p className="text-sm text-gray-500">{storeItems[0]?.offer?.store?.address ?? ""}</p>
            </div>
            <ul className="space-y-3">
              {storeItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{item.offer?.product?.name}</p>
                    <p className="text-xs text-gray-500">{item.offer?.product?.brand}</p>
                  </div>
                  <div className="text-right">
                    <p>€{(item.offer?.price ?? 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">x {item.qty ?? 1}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
