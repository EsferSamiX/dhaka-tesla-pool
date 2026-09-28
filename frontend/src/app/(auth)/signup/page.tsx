"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { homeFor, useMe, useSignUp } from "@/hooks/use-auth";
import type { Role } from "@/lib/types";

export default function SignUpPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const signUp = useSignUp();

  const [role, setRole] = useState<Role>("PASSENGER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [capacity, setCapacity] = useState(3);

  useEffect(() => {
    if (me) router.replace(homeFor(me.role));
  }, [me, router]);

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Ride as a passenger, or drive your own Tesla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            signUp.mutate(
              {
                name,
                email,
                password,
                role,
                vehicle:
                  role === "DRIVER"
                    ? { name: vehicleName, plateNumber, capacity }
                    : undefined,
              },
              { onSuccess: (user) => router.replace(homeFor(user.role)) },
            );
          }}
        >
          <div
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="I want to"
          >
            {(["PASSENGER", "DRIVER"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                role="radio"
                aria-checked={role === option}
                variant={role === option ? "default" : "outline"}
                onClick={() => setRole(option)}
              >
                {option === "PASSENGER" ? "Ride" : "Drive"}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>

          {role === "DRIVER" && (
            <fieldset className="space-y-4 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Your Tesla</legend>
              <div className="space-y-2">
                <Label htmlFor="vehicle-name">Name</Label>
                <Input
                  id="vehicle-name"
                  placeholder="Bullet"
                  required
                  maxLength={50}
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="plate">Plate number</Label>
                  <Input
                    id="plate"
                    placeholder="DM-TA-11-2025"
                    required
                    maxLength={20}
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Seats</Label>
                  <Input
                    id="capacity"
                    type="number"
                    className="w-20"
                    min={1}
                    max={6}
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </div>
              </div>
            </fieldset>
          )}

          <FormError error={signUp.error} />
          <Button type="submit" className="w-full" disabled={signUp.isPending}>
            {signUp.isPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
