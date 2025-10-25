import Link from "next/link";
import { createServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function AppNav() {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            spespe
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <Link href="/search" className="hover:underline">
              Cerca offerte
            </Link>
            {user && (
              <>
                <Link href="/lista" className="hover:underline">
                  Lista
                </Link>
                <Link href="/dashboard" className="hover:underline">
                  Dashboard
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-gray-600 sm:inline">{user.email}</span>
              <SignOutButton className="rounded border px-3 py-1 text-sm hover:bg-gray-50" />
            </>
          ) : (
            <Link href="/login" className="rounded border px-3 py-1 hover:bg-gray-50">
              Accedi
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
