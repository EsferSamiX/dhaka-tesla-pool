import { expect, requestRide, test } from './support';

test.describe('Passenger', () => {
  test('sees the alone, shared and full-Tesla prices before booking', async ({
    cast,
  }) => {
    const nusrat = await cast.passenger('Nusrat');
    const page = await nusrat.open('/passenger');

    await page.locator('#pickup').click();
    await page.getByRole('option', { name: 'Banani', exact: true }).click();
    await page.locator('#destination').click();
    await page.getByRole('option', { name: 'Mohakhali', exact: true }).click();

    await expect(page.getByText('৳75', { exact: true })).toBeVisible();
    await expect(page.getByText('৳60', { exact: true })).toBeVisible();
    await expect(page.getByText('৳52.50', { exact: true })).toBeVisible();
    await expect(page.getByText('With 3', { exact: true })).toBeVisible();
  });

  test('cancelling your own ride goes straight back to booking', async ({
    cast,
  }) => {
    const shirin = await cast.passenger('Shirin');
    // Mirpur 10 → Mirpur 11: no driver in these tests starts there.
    await requestRide(shirin, 'M10', 'M11');
    const page = await shirin.open('/passenger');
    await expect(page.getByText('Finding a Tesla').first()).toBeVisible();

    await page.getByRole('button', { name: 'Cancel ride' }).click();
    await page.getByRole('button', { name: 'Yes, cancel' }).click();

    await expect(page.getByText('Request a ride')).toBeVisible();
    // Give a late "trip ended" card the chance to appear; it must not.
    await page.waitForTimeout(3500);
    await expect(page.getByText('Your trip has ended')).toHaveCount(0);
  });

  test('a broken ride link shows "not found" instead of crashing', async ({
    cast,
  }) => {
    const rafiq = await cast.passenger('Rafiq');
    const page = await rafiq.open('/passenger/rides/not-a-ride');
    await expect(page.getByText('Ride not found')).toBeVisible();
  });
});
