import { DISTANCE_KM, USERS, ZONES } from './seed-data.js';

const index = (code: string) => ZONES.findIndex((z) => z.code === code);
const km = (from: string, to: string) => DISTANCE_KM[index(from)][index(to)];

describe('seed data', () => {
  it('has one distance row and column per zone', () => {
    expect(DISTANCE_KM).toHaveLength(ZONES.length);
    for (const row of DISTANCE_KM) expect(row).toHaveLength(ZONES.length);
  });

  it('uses unique zone codes and names', () => {
    expect(new Set(ZONES.map((z) => z.code)).size).toBe(ZONES.length);
    expect(new Set(ZONES.map((z) => z.name)).size).toBe(ZONES.length);
  });

  it('stores whole, positive, symmetric distances', () => {
    ZONES.forEach((_, i) =>
      ZONES.forEach((_, j) => {
        const d = DISTANCE_KM[i][j];
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBe(DISTANCE_KM[j][i]);
        if (i === j) expect(d).toBe(0);
        else expect(d).toBeGreaterThan(0);
      }),
    );
  });

  // Guarantees a detour can never be negative.
  it('satisfies the triangle inequality for every zone triple', () => {
    const n = ZONES.length;
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++)
        for (let c = 0; c < n; c++)
          expect(DISTANCE_KM[a][b]).toBeLessThanOrEqual(
            DISTANCE_KM[a][c] + DISTANCE_KM[c][b],
          );
  });

  it("matches the distances in Nusrat's and Rafiq's worked example", () => {
    expect(km('BAN', 'MOH')).toBe(3);
    expect(km('BAN', 'GL1')).toBe(4);
    expect(km('MOH', 'GL1')).toBe(3);
  });

  it('seeds the story cast with Bullet as a 3-seat vehicle', () => {
    expect(USERS.map((u) => u.name)).toEqual([
      'Jashim',
      'Nusrat',
      'Rafiq',
      'Shirin',
    ]);
    const jashim = USERS.find((u) => u.name === 'Jashim');
    expect(jashim?.role).toBe('DRIVER');
    expect(jashim?.vehicle).toMatchObject({ name: 'Bullet', capacity: 3 });
  });
});
