"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { homeFor, useMe } from "@/hooks/use-auth";
import type { Role } from "@/lib/types";

/**
 * Shows its children only to a signed-in user with the given role. Everyone
 * else is sent to sign in, or to their own home page. This is a convenience
 * for the UI: the API enforces the same rules on every request.
 */
export function RequireRole({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, isPending, isError, error, refetch } = useMe();

  useEffect(() => {
    if (isPending || isError) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me.role !== role) router.replace(homeFor(me.role));
  }, [me, isPending, isError, role, pathname, router]);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!me || me.role !== role) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return children;
}
