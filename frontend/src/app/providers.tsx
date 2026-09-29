"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ME_KEY } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { onAuthFromOtherTabs } from "@/lib/auth-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    // Any 401 means the session is gone (signed out elsewhere, or expired).
    // Forgetting the cached user lets the page guards send the user to sign
    // in, instead of showing a "Not signed in" error.
    const onError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        signedOut(client);
      }
    };
    const client: QueryClient = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          // A 4xx won't fix itself on retry; network hiccups might.
          retry: (count, error) =>
            !(
              error instanceof ApiError &&
              error.status >= 400 &&
              error.status < 500
            ) && count < 2,
          refetchOnWindowFocus: true,
        },
      },
    });
    return client;
  });

  // Follow sign-ins and sign-outs made in other tabs straight away.
  useEffect(
    () =>
      onAuthFromOtherTabs((event) => {
        if (event === "signed-out") signedOut(client);
        else {
          // Keep the "me" query (the page is subscribed to it) and reload it.
          client.removeQueries({
            predicate: (query) => query.queryKey[0] !== ME_KEY[0],
          });
          void client.refetchQueries({ queryKey: ME_KEY });
        }
      }),
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Drop everything cached for the old session and mark the user signed out. */
function signedOut(client: QueryClient) {
  if (client.getQueryData(ME_KEY) === null) return; // already handled
  client.removeQueries({
    predicate: (query) => query.queryKey[0] !== ME_KEY[0],
  });
  client.setQueryData(ME_KEY, null);
}
