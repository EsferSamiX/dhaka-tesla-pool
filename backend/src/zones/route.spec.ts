import { ZONES } from '../database/seed-data.js';
import { planRoute, roadPath } from './route.js';

const names = (route: ReturnType<typeof planRoute>) =>
  route.points.map((p) => p.name);

describe('roadPath', () => {
  it('connects every pair of zones', () => {
    for (const a of ZONES) {
      for (const b of ZONES) {
        if (a === b) continue;
        const path = roadPath(a.code, b.code);
        expect(path[0]).toBe(a.code);
        expect(path.at(-1)).toBe(b.code);
      }
    }
  });

  it('takes the airport road from Uttara', () => {
    expect(roadPath('UTT', 'BAN')).toEqual([
      'UTT',
      'AIR',
      'KHL',
      'KUR',
      'KAK',
      'BAN',
    ]);
  });
});

describe('planRoute', () => {
  const stops = (droppedNusrat: boolean, droppedRafiq = false) => [
    { zoneCode: 'MOH', riders: ['Nusrat'], dropped: droppedNusrat },
    { zoneCode: 'GL1', riders: ['Rafiq'], dropped: droppedRafiq },
  ];

  it("draws Nusrat's and Rafiq's trip with the areas in between", () => {
    const route = planRoute('BAN', stops(false), 'MATCHED');

    expect(names(route)).toEqual([
      'Banani',
      'Kakoli',
      'Mohakhali',
      'Amtoli',
      'Gulshan 1',
    ]);
    expect(route.points.map((p) => p.kind)).toEqual([
      'PICKUP',
      'VIA',
      'DROP_OFF',
      'VIA',
      'DROP_OFF',
    ]);
    expect(route.points[2].riders).toEqual(['Nusrat']);
    expect(route).toMatchObject({ position: 0, moving: false });
  });

  it('moves the Tesla along as passengers get off', () => {
    expect(planRoute('BAN', stops(false), 'STARTED')).toMatchObject({
      position: 0,
      moving: true,
    });
    expect(planRoute('BAN', stops(true), 'STARTED')).toMatchObject({
      position: 2,
      moving: true,
    });
    expect(planRoute('BAN', stops(true, true), 'COMPLETED')).toMatchObject({
      position: 4,
      moving: false,
    });
  });

  it('makes one stop for riders getting off in the same zone', () => {
    const route = planRoute(
      'BAN',
      [
        { zoneCode: 'MOH', riders: ['Nusrat'], dropped: false },
        { zoneCode: 'MOH', riders: ['Shirin'], dropped: false },
      ],
      'STARTED',
    );
    expect(names(route)).toEqual(['Banani', 'Kakoli', 'Mohakhali']);
    expect(route.points[2].riders).toEqual(['Nusrat', 'Shirin']);
  });
});
