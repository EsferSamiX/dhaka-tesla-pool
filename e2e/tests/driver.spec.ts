import {
  accept,
  errorBoxes,
  expect,
  goOnline,
  requestRide,
  test,
} from './support';

test.describe('Driver', () => {
  test('a 4th rider is listed once Bullet is full, but cannot be added', async ({
    cast,
  }) => {
    const jashim = await cast.driver('Jashim');
    const [nusrat, rafiq, shirin, bappi] = await Promise.all(
      ['Nusrat', 'Rafiq', 'Shirin', 'Bappi'].map((n) => cast.passenger(n)),
    );
    await goOnline(jashim);

    // Pickup Gulshan 2: Banani, Mohakhali and Farmgate all fit one Tesla.
    const first = await requestRide(nusrat, 'GL2', 'BAN');
    await accept(jashim, first.id);
    expect((await requestRide(rafiq, 'GL2', 'MOH')).status).toBe('MATCHED');
    expect((await requestRide(shirin, 'GL2', 'FRM')).status).toBe('MATCHED');
    expect((await requestRide(bappi, 'GL2', 'DHN')).status).toBe('REQUESTED');

    const page = await jashim.open('/driver');
    await expect(page.getByText('3 of 3 seats taken')).toBeVisible();
    await expect(page.getByText('Full · 30% off each')).toBeVisible();

    const row = page.getByRole('listitem').filter({ hasText: 'Bappi' });
    await expect(row).toContainText("Your seats are full; you can't add more");
    await expect(row.getByRole('button', { name: 'Accept' })).toBeDisabled();
  });

  test('stops taking riders once the Tesla is boarding', async ({ cast }) => {
    const jashim = await cast.driver('Jashim');
    const nusrat = await cast.passenger('Nusrat');
    const rafiq = await cast.passenger('Rafiq');
    await goOnline(jashim);

    // Pickup Mirpur 1.
    await accept(jashim, (await requestRide(nusrat, 'MR1', 'MR2')).id);
    const page = await jashim.open('/driver');
    await page.getByRole('button', { name: "I've arrived" }).click();
    await expect(page.getByText('Waiting for passengers to board')).toBeVisible();

    // Rafiq asks from the same zone, but the Tesla is already boarding.
    expect((await requestRide(rafiq, 'MR1', 'M10')).status).toBe('REQUESTED');
    await expect(
      page.getByText("Your Tesla is boarding, so it can't take new riders."),
    ).toBeVisible();
    await expect(page.getByText('Rafiq')).toHaveCount(0);
  });

  test('going offline and back online never flashes an error', async ({
    cast,
  }) => {
    const jashim = await cast.driver('Jashim');
    await goOnline(jashim);
    const page = await jashim.open('/driver');
    await expect(page.getByRole('button', { name: 'Go offline' })).toBeVisible();

    // Hold each status change for longer than one poll: the server has
    // already switched while the page still thinks it hasn't.
    await page.route('**/api/driver/status', async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await route.fulfill({ response });
    });
    // Record any error box that appears at any moment, not just at the end.
    await page.evaluate(() => {
      const w = window as unknown as { sawError: boolean };
      w.sawError = false;
      new MutationObserver(() => {
        if (document.querySelector('[data-slot="alert"]')) w.sawError = true;
      }).observe(document.body, { childList: true, subtree: true });
    });

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Go offline' }).click();
      await expect(page.getByRole('button', { name: 'Go online' })).toBeVisible(
        { timeout: 15_000 },
      );
      await page.getByRole('button', { name: 'Go online' }).click();
      await expect(page.getByRole('button', { name: 'Go offline' })).toBeVisible(
        { timeout: 15_000 },
      );
      await page.waitForTimeout(3500); // a couple of polls
    }
    await expect(errorBoxes(page)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as unknown as { sawError: boolean }).sawError,
      ),
    ).toBe(false);
  });
});
