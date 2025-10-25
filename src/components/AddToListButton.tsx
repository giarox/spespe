"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { offerId: string };

export default function AddToListButton({ offerId }: Props) {
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login?redirect=/lista";
      return;
    }

    try {
      await supabase.from("users").upsert({ id: user.id, email: user.email }, { onConflict: "id" });

      let listId: string | undefined;
      const { data: existingList, error: fetchListError } = await supabase
        .from("lists")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fetchListError) {
        throw fetchListError;
      }
      if (existingList?.id) {
        listId = existingList.id;
      } else {
        const { data: newList, error: insertListError } = await supabase
          .from("lists")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (insertListError) {
          throw insertListError;
        }
        listId = newList.id;
      }

      const { error: itemError } = await supabase
        .from("list_items")
        .upsert({ list_id: listId, offer_id: offerId, qty: 1 }, { onConflict: "list_id,offer_id" });
      if (itemError) {
        throw itemError;
      }
      setStatus("added");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  const label =
    status === "loading" ? "Sto aggiungendo..." : status === "added" ? "Aggiunto!" : status === "error" ? "Errore" : "Aggiungi alla lista";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === "loading"}
      className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
    >
      {label}
    </button>
  );
}
