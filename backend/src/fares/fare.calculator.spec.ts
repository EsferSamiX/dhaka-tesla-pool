import { calculateFare, percentOf } from './fare.calculator.js';

// Test cases F1–F9 from docs/fare-model.md §8. Amounts are in paisa.
describe('calculateFare', () => {
  const fare = (distanceKm: number, seats: number, pooled: boolean) =>
    calculateFare({ distanceKm, seats, pooled }).finalFarePaisa;

  it.each`
    id      | trip                                    | km    | seats | pooled   | expected
    ${'F1'} | ${'Nusrat, Banani → Mohakhali, pooled'} | ${3}  | ${1}  | ${true}  | ${6000}
    ${'F2'} | ${'Rafiq, Banani → Gulshan 1, pooled'}  | ${4}  | ${1}  | ${true}  | ${7200}
    ${'F3'} | ${'Nusrat alone'}                       | ${3}  | ${1}  | ${false} | ${7500}
    ${'F4'} | ${'Rafiq alone'}                        | ${4}  | ${1}  | ${false} | ${9000}
    ${'F5'} | ${'Rafiq, 2 seats, pooled'}             | ${4}  | ${2}  | ${true}  | ${14400}
    ${'F6'} | ${'Rafiq, 2 seats, alone'}              | ${4}  | ${2}  | ${false} | ${18000}
    ${'F7'} | ${'Uttara → Dhanmondi, 3 seats, alone'} | ${19} | ${3}  | ${false} | ${94500}
  `('$id: $trip = $expected paisa', ({ km, seats, pooled, expected }) => {
    expect(fare(km, seats, pooled)).toBe(expected);
  });

  it("breaks Nusrat's pooled fare down exactly as documented", () => {
    expect(calculateFare({ distanceKm: 3, seats: 1, pooled: true })).toEqual({
      baseFarePaisa: 3000,
      perKmRatePaisa: 1500,
      distanceChargePaisa: 4500,
      subtotalPaisa: 7500,
      poolDiscountBps: 2000,
      poolDiscountPaisa: 1500,
      finalFarePaisa: 6000,
    });
  });

  it('F8: the final fare never exceeds the solo estimate', () => {
    for (let km = 1; km <= 20; km++) {
      for (let seats = 1; seats <= 3; seats++) {
        expect(fare(km, seats, true)).toBeLessThanOrEqual(
          fare(km, seats, false),
        );
      }
    }
  });

  it('F9: rejects invalid input', () => {
    for (const [km, seats] of [
      [3, 0],
      [3, 4],
      [3, 1.5],
      [0, 1],
      [-2, 1],
      [2.5, 1],
    ]) {
      expect(() => fare(km, seats, false)).toThrow(RangeError);
    }
  });

  it('only ever returns whole paisa', () => {
    for (let km = 1; km <= 20; km++) {
      const breakdown = calculateFare({
        distanceKm: km,
        seats: 3,
        pooled: true,
      });
      for (const value of Object.values(breakdown)) {
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });
});

describe('percentOf', () => {
  it('rounds half up to the nearest paisa', () => {
    expect(percentOf(7500, 2000)).toBe(1500);
    expect(percentOf(1, 5000)).toBe(1); // 0.5 → 1
    expect(percentOf(1, 4999)).toBe(0); // 0.4999 → 0
  });
});
