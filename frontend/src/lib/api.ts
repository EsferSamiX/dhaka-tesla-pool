/**
 * The only way the app talks to the backend. Requests go to this app's own
 * `/api/*` (proxied to NestJS), so the session cookie is sent automatically.
 */

/** An error response from the API, in its documented shape. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** One message, or several for validation errors. */
    readonly messages: string[],
    readonly requestId?: string,
  ) {
    super(messages.join(" · "));
    this.name = "ApiError";
  }
}

interface ErrorBody {
  statusCode?: number;
  message?: string | string[];
  requestId?: string;
}

type Method = "GET" | "POST" | "PATCH";

export async function api<T>(
  path: string,
  options: { method?: Method; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers:
        options.body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, ["Can't reach the server. Check your connection."]);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: e.g. the proxy's plain-text 500 when the API is down.
  }

  if (!res.ok) {
    const body = (data ?? {}) as ErrorBody;
    const message =
      body.message ??
      (res.status >= 500
        ? "The server is having trouble. Please try again shortly."
        : res.statusText || "Something went wrong");
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message : [message],
      body.requestId,
    );
  }
  return data as T;
}
