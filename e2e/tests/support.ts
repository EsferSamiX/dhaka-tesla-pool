import {
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
  expect,
  request,
  test as base,
} from '@playwright/test';

export { expect };

const PASSWORD = 'e2e-password-1';
let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface Person {
  name: string;
  email: string;
  password: string;
  /** Signed-in API client, for setting up state quickly. */
  api: APIRequestContext;
  /** Opens a browser tab signed in as this person. */
  open(path: string): Promise<Page>;
}

export interface Cast {
  passenger(name: string): Promise<Person>;
  driver(name: string, capacity?: number): Promise<Person>;
}

async function signUp(
  baseURL: string,
  browser: Browser,
  contexts: BrowserContext[],
  name: string,
  vehicleCapacity?: number,
): Promise<Person> {
  const api = await request.newContext({ baseURL });
  const email = `${name.toLowerCase()}-${unique()}@e2e-ui.test`;
  const res = await api.post('/api/auth/signup', {
    data: {
      name,
      email,
      password: PASSWORD,
      role: vehicleCapacity ? 'DRIVER' : 'PASSENGER',
      vehicle: vehicleCapacity
        ? {
            name: 'Bullet',
            plateNumber: `E2E-${unique()}`.toUpperCase().slice(0, 20),
            capacity: vehicleCapacity,
          }
        : undefined,
    },
  });
  expect(res.status(), await res.text()).toBe(201);

  return {
    name,
    email,
    password: PASSWORD,
    api,
    async open(path) {
      const context = await browser.newContext({
        storageState: await api.storageState(),
      });
      contexts.push(context);
      const page = await context.newPage();
      await page.goto(path);
      return page;
    },
  };
}

/** The body as JSON; the API answers `null` with an empty body. */
async function jsonOrNull(res: APIResponse) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** Ends whatever the test left open, so later tests start clean. */
async function cleanUp(people: { person: Person; driver: boolean }[]) {
  for (const { person, driver } of people) {
    if (!driver) continue;
    const pool = await jsonOrNull(await person.api.get('/api/driver/pool'));
    if (pool?.status === 'STARTED') {
      await person.api.post('/api/driver/pool/complete');
    } else if (pool?.status) {
      await person.api.post('/api/driver/pool/cancel', { data: {} });
    }
    await person.api.patch('/api/driver/status', {
      data: { isOnline: false },
    });
  }
  for (const { person, driver } of people) {
    if (driver) continue;
    const ride = await jsonOrNull(await person.api.get('/api/rides/active'));
    if (ride?.id && ride.status !== 'STARTED') {
      await person.api.post(`/api/rides/${ride.id}/cancel`, { data: {} });
    }
  }
  for (const { person } of people) await person.api.dispose();
}

export const test = base.extend<{ cast: Cast }>({
  cast: async ({ browser, baseURL }, use) => {
    const people: { person: Person; driver: boolean }[] = [];
    const contexts: BrowserContext[] = [];
    await use({
      async passenger(name) {
        const person = await signUp(baseURL!, browser, contexts, name);
        people.push({ person, driver: false });
        return person;
      },
      async driver(name, capacity = 3) {
        const person = await signUp(
          baseURL!,
          browser,
          contexts,
          name,
          capacity,
        );
        people.push({ person, driver: true });
        return person;
      },
    });
    for (const context of contexts) await context.close();
    await cleanUp(people);
  },
});

/** Requests a ride through the API and returns its id and status. */
export async function requestRide(
  who: Person,
  pickupZone: string,
  destinationZone: string,
  seats = 1,
): Promise<{ id: string; status: string }> {
  const res = await who.api.post('/api/rides', {
    data: { pickupZone, destinationZone, seats },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

export async function goOnline(driver: Person) {
  const res = await driver.api.patch('/api/driver/status', {
    data: { isOnline: true },
  });
  expect(res.ok()).toBe(true);
}

export async function accept(driver: Person, rideId: string) {
  const res = await driver.api.post(`/api/driver/requests/${rideId}/accept`);
  expect(res.status(), await res.text()).toBe(200);
}

/** Our error boxes (Next.js adds its own hidden role="alert" to every page). */
export const errorBoxes = (page: Page) => page.locator('[data-slot="alert"]');
