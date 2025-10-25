"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "./SignOutButton";

export default function AuthStatus() {
  const supabase = createClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!email) {
    return (
      <div className="text-sm">
        Non sei loggato — <a className="underline" href="/login">Accedi</a>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p>Sei autenticato come <strong>{email}</strong></p>
      <SignOutButton />
    </div>
  );
}
