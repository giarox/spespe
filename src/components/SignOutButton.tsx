"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className={className ?? "underline"}
      type="button"
    >
      {loading ? "Sto uscendo..." : "Esci"}
    </button>
  );
}
