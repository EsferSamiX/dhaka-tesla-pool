import { accept, expect, goOnline, requestRide, test } from './support';

/**
 * One full shared trip from Tejgaon, driven through the UI: pooling, seat
 * boxes, drop-offs in order, and the end-of-trip screens on both sides.
 * Fares with 3 riders (30% off): Mohakhali 3 km ৳52.50, Gulshan 1 5 km
 * ৳73.50, Gulshan 2 6 km ৳84; total ৳210.
 */
test('a full Tesla from pickup to the last drop-off', async ({ cast }) => {
  const jashim = await cast.driver('Jashim');
  const [nusrat, rafiq, shirin] = await Promise.all(
    ['Nusrat', 'Rafiq', 'Shirin'].map((n) => cast.passenger(n)),
  );
  await goOnline(jashim);

  // Nusrat asks first; Jashim accepts her from his screen.
  const nusratsRide = await requestRide(nusrat, 'TEJ', 'MOH');
  const driver = await jashim.open('/driver');
  await driver
    .getByRole('listitem')
    .filter({ hasText: 'Nusrat' })
    .getByRole('button', { name: 'Accept' })
    .click();
  await expect(driver.getByText('Head to the pickup')).toBeVisible();

  // Rafiq and Shirin join Jashim's Tesla on their own.
  expect((await requestRide(rafiq, 'TEJ', 'GL1')).status).toBe('MATCHED');
  expect((await requestRide(shirin, 'TEJ', 'GL2')).status).toBe('MATCHED');

  const nusratsPage = await nusrat.open('/passenger');
  const shirinsPage = await shirin.open('/passenger');
  for (const page of [driver, nusratsPage, shirinsPage]) {
    await expect(page.getByText('3 of 3 seats taken')).toBeVisible();
  }
  await expect(driver.getByText('Full · 30% off each')).toBeVisible();
  await expect(nusratsPage.getByText('৳52.50').first()).toBeVisible();

  await driver.getByRole('button', { name: "I've arrived" }).click();
  await driver.getByRole('button', { name: 'Start trip' }).click();
  await expect(driver.getByText('Trip in progress')).toBeVisible();

  // Drop-offs go nearest first: only Nusrat (Mohakhali) can get off now.
  const dropFor = (name: string) =>
    driver
      .getByRole('listitem')
      .filter({ hasText: name })
      .getByRole('button', { name: 'Drop off' });
  await expect(dropFor('Nusrat')).toBeEnabled();
  await expect(dropFor('Rafiq')).toBeDisabled();
  await expect(dropFor('Shirin')).toBeDisabled();

  // Nusrat is the first drop-off, straight after the start.
  await dropFor('Nusrat').click();
  await expect(driver.getByText('Dropped · paid')).toBeVisible();
  await expect(driver.getByText('2 of 3 seats taken')).toBeVisible();
  await expect(nusratsPage.getByText('Your trip has ended')).toBeVisible();
  await expect(nusratsPage.getByText('Paid in cash')).toBeVisible();
  await expect(shirinsPage.getByText('Nusrat (dropped off)')).toBeVisible();

  // Finish drops off Rafiq and Shirin together.
  await driver.getByRole('button', { name: 'Finish trip' }).click();
  await expect(driver.getByText('Trip completed')).toBeVisible();
  await expect(driver.getByText('৳210').first()).toBeVisible();
  await expect(shirinsPage.getByText('Your trip has ended')).toBeVisible();

  // Both sides stay on the summary until they move on.
  await driver.waitForTimeout(4000);
  await expect(driver.getByText('Trip completed')).toBeVisible();
  await driver.getByRole('button', { name: 'End trip' }).click();
  await expect(driver.getByText('Waiting for a ride')).toBeVisible();

  await nusratsPage.getByRole('button', { name: 'Back to home' }).click();
  await expect(nusratsPage.getByText('Request a ride')).toBeVisible();

  const ride = await (await nusrat.api.get(`/api/rides/${nusratsRide.id}`)).json();
  expect(ride).toMatchObject({ status: 'COMPLETED', fare: { finalPaisa: 5250 } });
});
