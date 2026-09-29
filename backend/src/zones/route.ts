import { ZONES } from '../database/seed-data.js';

/**
 * The path a Tesla takes, for display only (docs/assumptions.md §3.3).
 *
 * A small hand-drawn road map: our 14 zones plus a few well-known areas in
 * between them, joined by the main roads. The shortest path between two
 * stops gives the "middle areas" shown on the trip line. Fares never use
 * this map; they use the distance table.
 */
const VIA_AREAS: Record<string, string> = {
  AIR: 'Airport',
  KHL: 'Khilkhet',
  KUR: 'Kuril',
  KAK: 'Kakoli',
  NDA: 'Nadda',
  AMT: 'Amtoli',
  ECB: 'ECB Chattar',
  KAL: 'Kalshi',
  DIA: 'Diabari',
  KCK: 'Kochukhet',
  AGR: 'Agargaon',
  SHY: 'Shyamoli',
  PNT: 'Panthapath',
};

// [from, to, km] — two-way roads, approximate lengths.
// prettier-ignore
const ROADS: readonly [string, string, number][] = [
  ['UTT', 'AIR', 4], ['AIR', 'KHL', 2], ['KHL', 'KUR', 2],
  ['KUR', 'KAK', 3], ['KAK', 'BAN', 1], ['KAK', 'MOH', 2],
  ['KUR', 'BSH', 2], ['BSH', 'NDA', 1], ['NDA', 'GL2', 3],
  ['BAN', 'GL2', 2], ['GL2', 'GL1', 2], ['GL1', 'AMT', 1], ['AMT', 'MOH', 2],
  ['MOH', 'TEJ', 3], ['TEJ', 'FRM', 2], ['FRM', 'PNT', 1], ['PNT', 'DHN', 2],
  ['FRM', 'AGR', 3], ['AGR', 'M10', 3], ['FRM', 'SHY', 3], ['SHY', 'DHN', 3],
  ['SHY', 'MR1', 3], ['MR1', 'MR2', 2], ['MR2', 'M10', 1], ['M10', 'M11', 2],
  ['M11', 'M12', 1], ['M12', 'KAL', 2], ['KAL', 'ECB', 1], ['ECB', 'KUR', 2],
  ['M10', 'KCK', 3], ['KCK', 'KAK', 3], ['UTT', 'DIA', 3], ['DIA', 'M12', 5],
];

const NAMES: Record<string, string> = {
  ...Object.fromEntries(ZONES.map((z) => [z.code, z.name])),
  ...VIA_AREAS,
};

const GRAPH = new Map<string, [string, number][]>();
for (const [a, b, km] of ROADS) {
  GRAPH.set(a, [...(GRAPH.get(a) ?? []), [b, km]]);
  GRAPH.set(b, [...(GRAPH.get(b) ?? []), [a, km]]);
}

/** Node codes on the shortest road path from `from` to `to`, both included. */
export function roadPath(from: string, to: string): string[] {
  if (!GRAPH.has(from) || !GRAPH.has(to)) {
    throw new Error(`No road map entry for ${from} or ${to}`);
  }
  // Dijkstra; the map is tiny, so a linear scan for the next node is fine.
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const done = new Set<string>();
  while (!done.has(to)) {
    let current: string | undefined;
    for (const [node, d] of dist) {
      if (!done.has(node) && (current === undefined || d < dist.get(current)!))
        current = node;
    }
    if (current === undefined) throw new Error(`No road from ${from} to ${to}`);
    done.add(current);
    for (const [next, km] of GRAPH.get(current)!) {
      const d = dist.get(current)! + km;
      if (d < (dist.get(next) ?? Infinity)) {
        dist.set(next, d);
        prev.set(next, current);
      }
    }
  }
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

export interface RoutePoint {
  name: string;
  kind: 'PICKUP' | 'DROP_OFF' | 'VIA';
  /** Who gets off here (first names), for drop-off points. */
  riders: string[];
}

export interface RouteView {
  points: RoutePoint[];
  /** Index of the point the Tesla is at, or has just left when `moving`. */
  position: number;
  /** True while driving from `position` towards the next point. */
  moving: boolean;
}

export interface RouteStop {
  zoneCode: string;
  riders: string[];
  dropped: boolean;
}

/**
 * The trip line: pickup, then each drop-off in order, with the areas in
 * between. `status` is the pool's (or a lone ride's) status.
 */
export function planRoute(
  pickupCode: string,
  stops: RouteStop[],
  status: string,
): RouteView {
  const points: RoutePoint[] = [
    { name: NAMES[pickupCode], kind: 'PICKUP', riders: [] },
  ];
  // Several riders can get off in the same zone; that is one stop.
  const merged: RouteStop[] = [];
  for (const stop of stops) {
    const last = merged.at(-1);
    if (last?.zoneCode === stop.zoneCode) {
      last.riders.push(...stop.riders);
      last.dropped &&= stop.dropped;
    } else {
      merged.push({ ...stop, riders: [...stop.riders] });
    }
  }

  let at = pickupCode;
  let position = 0;
  for (const stop of merged) {
    if (stop.zoneCode === at) continue;
    const between = roadPath(at, stop.zoneCode).slice(1, -1);
    for (const code of between) {
      points.push({ name: NAMES[code], kind: 'VIA', riders: [] });
    }
    points.push({
      name: NAMES[stop.zoneCode],
      kind: 'DROP_OFF',
      riders: stop.riders,
    });
    if (stop.dropped) position = points.length - 1;
    at = stop.zoneCode;
  }

  const finished = status === 'COMPLETED';
  return {
    points,
    position: finished ? points.length - 1 : position,
    moving: status === 'STARTED' && position < points.length - 1,
  };
}
