"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

/** Human-readable messages for any error thrown by `api()`. */
export function errorMessages(error: unknown): string[] {
  if (error instanceof ApiError) return error.messages;
  return ["Something went wrong. Please try again."];
}

/** Inline error for forms and actions. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const messages = errorMessages(error);
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertDescription>
        {messages.length === 1 ? (
          messages[0]
        ) : (
          <ul className="list-disc pl-4">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Full-width error for a failed page load, with a retry button. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle />
      <AlertTitle>Couldn&apos;t load this</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{errorMessages(error).join(" ")}</p>
        {requestId && (
          <p className="text-xs opacity-80">Reference: {requestId}</p>
        )}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Friendly placeholder when a list has nothing in it yet. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      )}
    </div>
  );
}
