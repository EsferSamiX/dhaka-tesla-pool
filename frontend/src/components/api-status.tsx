"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "checking" | "online" | "offline";

const LABELS: Record<Status, string> = {
  checking: "Checking API…",
  online: "API online",
  offline: "API unreachable",
};

const DOT_COLORS: Record<Status, string> = {
  checking: "bg-muted-foreground animate-pulse",
  online: "bg-emerald-500",
  offline: "bg-destructive",
};

async function probeApi(): Promise<Status> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return res.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}

export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    void probeApi().then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const check = useCallback(async () => {
    setStatus("checking");
    setStatus(await probeApi());
  }, []);

  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 text-sm" role="status">
        <span className={`size-2 rounded-full ${DOT_COLORS[status]}`} />
        {LABELS[status]}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={check}
        disabled={status === "checking"}
      >
        Check again
      </Button>
    </div>
  );
}
