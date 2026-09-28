"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { homeFor, useMe, useSignOut } from "@/hooks/use-auth";

export function SiteHeader() {
  const router = useRouter();
  const { data: me } = useMe();
  const signOut = useSignOut();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4">
        <Link
          href={me ? homeFor(me.role) : "/"}
          className="font-semibold tracking-tight"
        >
          Dhaka Tesla Pool
        </Link>

        {me && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{me.name}</span>
            <Badge variant="secondary">
              {me.role === "DRIVER" ? "Driver" : "Passenger"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              disabled={signOut.isPending}
              onClick={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => router.replace("/login"),
                })
              }
            >
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
