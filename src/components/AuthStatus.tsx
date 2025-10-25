"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type UserInfo = { email: string | null } | null;

export default function AuthStatus() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser({ email: data.user?.email ?? null });
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(({ data }) => {
        setUser({ email: data.user?.email ?? null });
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  if (!user?.email) {
    return (
      <div className="text-sm">
        Not signed in — <a href="/login" className="underline">Login</a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>Signed in as <strong>{user.email}</strong></span>
      <button onClick={signOut} className="underline">Sign out</button>
    </div>
  );
}
