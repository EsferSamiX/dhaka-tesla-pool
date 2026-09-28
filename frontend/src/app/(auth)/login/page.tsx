"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FormError } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { homeFor, useMe, useSignIn } from "@/hooks/use-auth";
import type { User } from "@/lib/types";

const DEMO_PASSWORD = "tesla1234";
const DEMO_ACCOUNTS = [
  { name: "Jashim", role: "Driver · Bullet", email: "jashim@dhakatesla.test" },
  { name: "Nusrat", role: "Passenger", email: "nusrat@dhakatesla.test" },
  { name: "Rafiq", role: "Passenger", email: "rafiq@dhakatesla.test" },
  { name: "Shirin", role: "Passenger", email: "shirin@dhakatesla.test" },
];

/** Only follow same-site paths from ?next=, never another origin. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { data: me } = useMe();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const goHome = (user: User) => router.replace(next ?? homeFor(user.role));

  // Already signed in: skip the form.
  useEffect(() => {
    if (me) router.replace(next ?? homeFor(me.role));
  }, [me, next, router]);

  function submit(credentials: { email: string; password: string }) {
    signIn.mutate(credentials, { onSuccess: goHome });
  }

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Passengers and drivers use the same form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit({ email, password });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FormError error={signIn.error} />
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <Separator />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Or try the story cast (password <code>{DEMO_PASSWORD}</code>):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                className="h-auto flex-col items-start py-2"
                disabled={signIn.isPending}
                onClick={() =>
                  submit({ email: account.email, password: DEMO_PASSWORD })
                }
              >
                <span>{account.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {account.role}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        New here?&nbsp;
        <Link
          href="/signup"
          className="text-foreground underline underline-offset-4"
        >
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to render on the server.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
