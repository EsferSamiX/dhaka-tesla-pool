"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiStatus } from "@/components/api-status";
import { Logo } from "@/components/logo";
import { HOME_PROMOS, PromoCarousel } from "@/components/promo-carousel";
import { buttonVariants } from "@/components/ui/button";
import { homeFor, useMe } from "@/hooks/use-auth";

export default function Home() {
  const router = useRouter();
  const { data: me } = useMe();

  // Signed-in users go straight to their own home.
  useEffect(() => {
    if (me) router.replace(homeFor(me.role));
  }, [me, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Logo className="size-24" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Dhaka Tesla Pool
          </h1>
          <p className="text-muted-foreground">
            Share a seat. Split the fare. Survive Dhaka traffic.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className={buttonVariants()}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className={buttonVariants({ variant: "outline" })}
          >
            Create account
          </Link>
        </div>
      </div>
      <PromoCarousel promos={HOME_PROMOS} className="w-full max-w-2xl" />
      <ApiStatus />
    </div>
  );
}
