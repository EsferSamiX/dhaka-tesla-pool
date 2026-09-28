import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Dhaka Tesla Pool
          </h1>
          <p className="text-muted-foreground">
            Share a seat. Split the fare. Survive Dhaka traffic.
          </p>
        </div>
        <ApiStatus />
      </div>
    </main>
  );
}
