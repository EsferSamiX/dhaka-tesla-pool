"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/lib/types";

export const ME_KEY = ["me"] as const;

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<User>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput extends SignInInput {
  name: string;
  role: Role;
  vehicle?: { name: string; plateNumber: string; capacity: number };
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInInput) =>
      api<User>("/auth/signin", { method: "POST", body: input }),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignUpInput) =>
      api<User>("/auth/signup", { method: "POST", body: input }),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/signout", { method: "POST" }),
    // Drop every cached query so the next user starts clean.
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}

/** Where each role lands after signing in. */
export function homeFor(role: Role): string {
  return role === "DRIVER" ? "/driver" : "/passenger";
}
