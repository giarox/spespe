import AuthStatus from "@/components/AuthStatus";

export default function Home() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">spespe</h1>
      <AuthStatus />
      <p className="opacity-70">Welcome! This is the MVP shell.</p>
    </main>
  );
}
