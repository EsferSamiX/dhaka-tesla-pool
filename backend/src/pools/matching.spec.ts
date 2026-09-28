import { DISTANCE_KM, ZONES } from '../database/seed-data.js';
import { isCompatible, planDropOffs, Rider } from './matching.js';

// Zone IDs are the positions in the seed data; distances come from the same
// table the database is seeded with.
const zone = (code: string) => ZONES.findIndex((z) => z.code === code);
const distance = (a: number, b: number) => DISTANCE_KM[a][b];

let clock = 0;
const riderTo = (id: string, destination: string): Rider => ({
  id,
  destinationZoneId: zone(destination),
  directKm: distance(zone('BAN'), zone(destination)),
  requestedAt: new Date(2026, 8, 28, 8, 41, clock++),
});

describe('planDropOffs', () => {
  it('routes Nusrat and Rafiq via Mohakhali: 0 km and 2 km detours', () => {
    const rafiq = riderTo('rafiq', 'GL1');
    const nusrat = riderTo('nusrat', 'MOH');

    const stops = planDropOffs([rafiq, nusrat], distance);

    expect(
      stops.map(({ id, order, inCarKm, detourKm }) => ({
        id,
        order,
        inCarKm,
        detourKm,
      })),
    ).toEqual([
      { id: 'nusrat', order: 1, inCarKm: 3, detourKm: 0 },
      { id: 'rafiq', order: 2, inCarKm: 6, detourKm: 2 },
    ]);
    expect(isCompatible(stops)).toBe(true);
  });

  it('rejects Banani → Uttara joining Nusrat: a 4 km detour', () => {
    const stops = planDropOffs(
      [riderTo('nusrat', 'MOH'), riderTo('uttara', 'UTT')],
      distance,
    );

    expect(stops.find((s) => s.id === 'uttara')).toMatchObject({
      inCarKm: 16,
      detourKm: 4,
    });
    expect(isCompatible(stops)).toBe(false);
  });

  it('seats Shirin with Nusrat at Mohakhali without adding a detour', () => {
    const stops = planDropOffs(
      [
        riderTo('nusrat', 'MOH'),
        riderTo('rafiq', 'GL1'),
        riderTo('shirin', 'MOH'),
      ],
      distance,
    );

    expect(stops.map((s) => [s.id, s.detourKm])).toEqual([
      ['nusrat', 0],
      ['shirin', 0],
      ['rafiq', 2],
    ]);
    expect(isCompatible(stops)).toBe(true);
  });

  it('breaks distance ties by who requested first', () => {
    const first = riderTo('first', 'GL2'); // 3 km
    const second = riderTo('second', 'MOH'); // also 3 km

    const stops = planDropOffs([second, first], distance);

    expect(stops.map((s) => s.id)).toEqual(['first', 'second']);
  });

  it('accepts a single rider with no detour', () => {
    const stops = planDropOffs([riderTo('solo', 'DHN')], distance);
    expect(stops).toMatchObject([{ order: 1, detourKm: 0 }]);
    expect(isCompatible(stops)).toBe(true);
  });

  it('never produces a negative detour for any pair of destinations', () => {
    for (const a of ZONES) {
      for (const b of ZONES) {
        if (a.code === 'BAN' || b.code === 'BAN') continue;
        const stops = planDropOffs(
          [riderTo('a', a.code), riderTo('b', b.code)],
          distance,
        );
        for (const s of stops) expect(s.detourKm).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
