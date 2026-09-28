/** ৳ display for integer paisa: 6000 → "৳60", 6050 → "৳60.50". */
export function taka(paisa: number): string {
  const whole = paisa % 100 === 0;
  return `৳${whole ? paisa / 100 : (paisa / 100).toFixed(2)}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

/** "29 Sept, 08:41", always in Dhaka time. */
export function formatWhen(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "just now", "4 min", "1 h 5 min": how long something has been waiting. */
export function waitedFor(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ""}`;
}
