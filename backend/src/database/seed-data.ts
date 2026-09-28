/**
 * Reference data and the story cast. Zones and distances mirror
 * docs/assumptions.md (sections 3.1 and 3.2); keep the two in sync.
 */

export interface ZoneSeed {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

// Approximate zone centres, used only for an optional map.
export const ZONES: readonly ZoneSeed[] = [
  { code: 'UTT', name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  { code: 'BSH', name: 'Bashundhara', lat: 23.8193, lng: 90.4526 },
  { code: 'BAN', name: 'Banani', lat: 23.7937, lng: 90.4066 },
  { code: 'GL1', name: 'Gulshan 1', lat: 23.7806, lng: 90.4163 },
  { code: 'GL2', name: 'Gulshan 2', lat: 23.7946, lng: 90.4143 },
  { code: 'MOH', name: 'Mohakhali', lat: 23.7778, lng: 90.4057 },
  { code: 'TEJ', name: 'Tejgaon', lat: 23.7596, lng: 90.3942 },
  { code: 'FRM', name: 'Farmgate', lat: 23.7577, lng: 90.3897 },
  { code: 'MR1', name: 'Mirpur 1', lat: 23.7956, lng: 90.3537 },
  { code: 'MR2', name: 'Mirpur 2', lat: 23.8067, lng: 90.3637 },
  { code: 'M10', name: 'Mirpur 10', lat: 23.8069, lng: 90.3687 },
  { code: 'M11', name: 'Mirpur 11', lat: 23.8193, lng: 90.3654 },
  { code: 'M12', name: 'Mirpur 12', lat: 23.8283, lng: 90.3645 },
  { code: 'DHN', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
];

/**
 * Road distances in whole kilometres. Row and column order match ZONES;
 * the diagonal is 0 and never stored.
 */
// prettier-ignore
export const DISTANCE_KM: readonly (readonly number[])[] = [
  //UTT BSH BAN GL1 GL2 MOH TEJ FRM MR1 MR2 M10 M11 M12 DHN
  [  0,  9, 12, 14, 12, 13, 15, 16, 14, 13, 12, 10,  9, 19], // UTT
  [  9,  0,  6,  5,  4,  7,  9, 11, 14, 13, 12, 12, 12, 14], // BSH
  [ 12,  6,  0,  4,  3,  3,  6,  7, 10,  9,  8,  9, 10, 10], // BAN
  [ 14,  5,  4,  0,  2,  3,  5,  7, 11, 11, 10, 11, 12, 10], // GL1
  [ 12,  4,  3,  2,  0,  4,  6,  8, 12, 11, 10, 10, 11, 11], // GL2
  [ 13,  7,  3,  3,  4,  0,  3,  4,  8,  8,  7,  8,  9,  7], // MOH
  [ 15,  9,  6,  5,  6,  3,  0,  2,  8,  8,  7,  8,  9,  5], // TEJ
  [ 16, 11,  7,  7,  8,  4,  2,  0,  7,  7,  6,  7,  8,  3], // FRM
  [ 14, 14, 10, 11, 12,  8,  8,  7,  0,  2,  3,  4,  5,  7], // MR1
  [ 13, 13,  9, 11, 11,  8,  8,  7,  2,  0,  2,  3,  4,  8], // MR2
  [ 12, 12,  8, 10, 10,  7,  7,  6,  3,  2,  0,  2,  3,  8], // M10
  [ 10, 12,  9, 11, 10,  8,  8,  7,  4,  3,  2,  0,  2,  9], // M11
  [  9, 12, 10, 12, 11,  9,  9,  8,  5,  4,  3,  2,  0, 10], // M12
  [ 19, 14, 10, 10, 11,  7,  5,  3,  7,  8,  8,  9, 10,  0], // DHN
];

export interface UserSeed {
  name: string;
  email: string;
  role: 'PASSENGER' | 'DRIVER';
  vehicle?: { name: string; plateNumber: string; capacity: number };
}

// Demo accounts. They all share DEMO_PASSWORD, for local use and the demo only.
export const DEMO_PASSWORD = 'tesla1234';

export const USERS: readonly UserSeed[] = [
  {
    name: 'Jashim',
    email: 'jashim@dhakatesla.test',
    role: 'DRIVER',
    vehicle: { name: 'Bullet', plateNumber: 'DM-TA-11-2025', capacity: 3 },
  },
  { name: 'Nusrat', email: 'nusrat@dhakatesla.test', role: 'PASSENGER' },
  { name: 'Rafiq', email: 'rafiq@dhakatesla.test', role: 'PASSENGER' },
  { name: 'Shirin', email: 'shirin@dhakatesla.test', role: 'PASSENGER' },
];
