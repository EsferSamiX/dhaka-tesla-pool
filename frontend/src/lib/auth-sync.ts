/**
 * Tells other open tabs of this app when the user signs in or out, so a tab
 * left open doesn't keep showing a session that no longer exists. The session
 * cookie is shared by every tab; only the cached user in each tab goes stale.
 */

export type AuthEvent = "signed-in" | "signed-out";

const CHANNEL = "dhaka-tesla-pool:auth";

function channel(): BroadcastChannel | null {
  return typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(CHANNEL);
}

/** Tell the other tabs. The sending tab does not receive its own message. */
export function announceAuth(event: AuthEvent): void {
  const ch = channel();
  if (!ch) return;
  ch.postMessage(event);
  ch.close();
}

/** Run `handler` when another tab signs in or out. Returns an unsubscribe. */
export function onAuthFromOtherTabs(
  handler: (event: AuthEvent) => void,
): () => void {
  const ch = channel();
  if (!ch) return () => {};
  ch.onmessage = (message: MessageEvent<AuthEvent>) => handler(message.data);
  return () => ch.close();
}
