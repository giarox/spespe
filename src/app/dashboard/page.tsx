import Link from "next/link";
import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="p-6 space-y-4">
      <div>
        <p className="text-sm uppercase tracking-wide text-gray-500">Hi</p>
        <h1 className="text-3xl font-semibold">{user.email ?? "Friend"}</h1>
      </div>
      <p className="text-gray-700">
        This is your placeholder dashboard. We will soon populate it with saved lists and nearby offers.
      </p>
      <div className="text-sm">
        <Link className="underline" href="/">
          ← Back home
        </Link>
      </div>
    </main>
  );
}
