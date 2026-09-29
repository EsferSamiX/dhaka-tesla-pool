"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CarFront,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LockKeyhole,
  type LucideIcon,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";

export interface Promo {
  icon: LucideIcon;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

export const HOME_PROMOS: Promo[] = [
  {
    icon: Users,
    title: "Share a seat, pay less",
    body: "Riders heading your way share one Tesla, and everyone on board gets a discount.",
    cta: { label: "Request a ride", href: "/login" },
  },
  {
    icon: Leaf,
    title: "Battery-powered rickshaws",
    body: "Quiet, clean and zero exhaust, even in Dhaka traffic.",
  },
  {
    icon: LockKeyhole,
    title: "Never pay more than quoted",
    body: "Your fare is locked when the trip starts, and never above the price for riding alone.",
  },
  {
    icon: CarFront,
    title: "Own a Tesla? Drive with us",
    body: "Go online, fill your seats with riders going your way, and earn more per trip.",
    cta: { label: "Become a driver", href: "/signup" },
  },
];

export const PASSENGER_PROMOS: Promo[] = [
  {
    icon: Users,
    title: "Share a seat, pay less",
    body: "If a Tesla heading your way has a free seat, you join it automatically and save.",
  },
  {
    icon: LockKeyhole,
    title: "Never pay more than quoted",
    body: "The alone price is the most you'll pay. Sharing only brings it down.",
  },
  {
    icon: Leaf,
    title: "Battery-powered rickshaws",
    body: "Quiet, clean and zero exhaust, even in Dhaka traffic.",
  },
];

const AUTOPLAY_MS = 5000;

/**
 * A small, dependency-free slider. Autoplays unless the user prefers reduced
 * motion, and pauses while hovered or focused so it never moves under someone
 * reading or tabbing through it.
 */
export function PromoCarousel({
  promos,
  className,
}: {
  promos: Promo[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = promos.length;

  const go = useCallback(
    (to: number) => setIndex(((to % count) + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused, count]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Why ride with Dhaka Tesla Pool"
      className={cn(
        "relative overflow-hidden rounded-xl bg-primary text-primary-foreground",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
        aria-live={paused ? "polite" : "off"}
      >
        {promos.map((promo, i) => {
          const Icon = promo.icon;
          return (
            <div
              key={promo.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              className="flex w-full shrink-0 items-center gap-4 px-6 py-5 sm:px-14"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-foreground/10">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold">{promo.title}</p>
                <p className="text-sm text-primary-foreground/75">
                  {promo.body}
                </p>
              </div>
              {promo.cta && (
                <Link
                  href={promo.cta.href}
                  tabIndex={i === index ? 0 : -1}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "hidden shrink-0 sm:inline-flex",
                  )}
                >
                  {promo.cta.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => go(index - 1)}
            className="absolute top-1/2 left-2 hidden -translate-y-1/2 rounded-full p-1.5 hover:bg-primary-foreground/10 sm:block"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => go(index + 1)}
            className="absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-full p-1.5 hover:bg-primary-foreground/10 sm:block"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="flex justify-center gap-1.5 pb-3">
            {promos.map((promo, i) => (
              <button
                key={promo.title}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-5 bg-primary-foreground"
                    : "w-1.5 bg-primary-foreground/40",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
