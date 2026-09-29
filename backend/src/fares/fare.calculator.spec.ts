import {
  calculateFare,
  percentOf,
  poolDiscountBpsFor,
} from './fare.calculator.js';

// Test cases from docs/fare-model.md §8. Amounts are in paisa.
describe('calculateFare', () => {
  const fare = (distanceKm: number, seats: number, passengers: number) =>
    calculateFare({ distanceKm, seats, passengers }).finalFarePaisa;

  it.each`
    id       | trip                                         | km    | seats | passengers | expected
    ${'F1'}  | ${'Nusrat, Banani → Mohakhali, shared by 2'} | ${3}  | ${1}  | ${2}       | ${6000}
    ${'F2'}  | ${'Rafiq, Banani → Gulshan 1, shared by 2'}  | ${4}  | ${1}  | ${2}       | ${7200}
    ${'F3'}  | ${'Nusrat alone'}                            | ${3}  | ${1}  | ${1}       | ${7500}
    ${'F4'}  | ${'Rafiq alone'}                             | ${4}  | ${1}  | ${1}       | ${9000}
    ${'F5'}  | ${'Rafiq, 2 seats, shared by 2'}             | ${4}  | ${2}  | ${2}       | ${14400}
    ${'F6'}  | ${'Rafiq, 2 seats, alone'}                   | ${4}  | ${2}  | ${1}       | ${18000}
    ${'F7'}  | ${'Uttara → Dhanmondi, 3 seats, alone'}      | ${19} | ${3}  | ${1}       | ${94500}
    ${'F10'} | ${'Nusrat, full Tesla (3 passengers)'}       | ${3}  | ${1}  | ${3}       | ${5250}
    ${'F11'} | ${'Rafiq, full Tesla (3 passengers)'}        | ${4}  | ${1}  | ${3}       | ${6300}
    ${'F12'} | ${'Bashundhara → Gulshan 1, full Tesla'}     | ${5}  | ${1}  | ${3}       | ${7350}
  `('$id: $trip = $expected paisa', ({ km, seats, passengers, expected }) => {
    expect(fare(km, seats, passengers)).toBe(expected);
  });

  it("breaks Nusrat's shared fare down exactly as documented", () => {
    expect(calculateFare({ distanceKm: 3, seats: 1, passengers: 2 })).toEqual({
      baseFarePaisa: 3000,
      perKmRatePaisa: 1500,
      distanceChargePaisa: 4500,
      subtotalPaisa: 7500,
      poolDiscountBps: 2000,
      poolDiscountPaisa: 1500,
      finalFarePaisa: 6000,
    });
  });

  it('gives everyone on board the same rate: 0%, 20%, then 30% from 3 up', () => {
    expect([1, 2, 3, 4, 6].map(poolDiscountBpsFor)).toEqual([
      0, 2000, 3000, 3000, 3000,
    ]);
  });

  it('counts passengers, not seats: one rider with two seats is alone', () => {
    expect(
      calculateFare({ distanceKm: 4, seats: 2, passengers: 1 }),
    ).toMatchObject({ poolDiscountBps: 0 });
  });

  it('F8: more passengers never cost anyone more, and never exceed the estimate', () => {
    for (let km = 1; km <= 20; km++) {
      for (let seats = 1; seats <= 3; seats++) {
        const alone = fare(km, seats, 1);
        const shared = fare(km, seats, 2);
        const full = fare(km, seats, 3);
        expect(shared).toBeLessThanOrEqual(alone);
        expect(full).toBeLessThanOrEqual(shared);
      }
    }
  });

  it('F9: rejects invalid input', () => {
    for (const [km, seats, passengers] of [
      [3, 0, 1],
      [3, 4, 1],
      [3, 1.5, 1],
      [0, 1, 1],
      [-2, 1, 1],
      [2.5, 1, 1],
      [3, 1, 0],
      [3, 1, 1.5],
    ]) {
      expect(() => fare(km, seats, passengers)).toThrow(RangeError);
    }
  });

  it('only ever returns whole paisa', () => {
    for (let km = 1; km <= 20; km++) {
      for (const passengers of [1, 2, 3]) {
        const breakdown = calculateFare({
          distanceKm: km,
          seats: 3,
          passengers,
        });
        for (const value of Object.values(breakdown)) {
          expect(Number.isInteger(value)).toBe(true);
        }
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
