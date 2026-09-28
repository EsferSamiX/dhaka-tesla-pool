/** ৳ display for integer paisa: 6000 → "৳60", 6050 → "৳60.50". */
export function taka(paisa: number): string {
  const whole = paisa % 100 === 0;
  return `৳${whole ? paisa / 100 : (paisa / 100).toFixed(2)}`;
}
