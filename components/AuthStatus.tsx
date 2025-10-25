"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthStatus() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="space-y-2">
      <p>You are signed in.</p>
      <button onClick={signOut} disabled={loading} className="underline">
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
