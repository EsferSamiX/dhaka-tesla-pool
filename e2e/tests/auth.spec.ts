import { errorBoxes, expect, test } from './support';

test.describe('Signing in', () => {
  test('the eye button shows and hides the password', async ({ page }) => {
    await page.goto('/login');
    const password = page.locator('#password');
    await password.fill('tesla1234');
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('a wrong password is refused', async ({ page, cast }) => {
    const nusrat = await cast.passenger('Nusrat');
    await page.goto('/login');
    await page.locator('#email').fill(nusrat.email);
    await page.locator('#password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(errorBoxes(page)).toContainText(
      'Invalid email or password',
    );
  });

  test('the right password leads to the passenger home', async ({
    page,
    cast,
  }) => {
    const nusrat = await cast.passenger('Nusrat');
    await page.goto('/login');
    await page.locator('#email').fill(nusrat.email);
    await page.locator('#password').fill(nusrat.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/passenger$/);
    await expect(page.getByRole('heading', { name: 'Hi Nusrat' })).toBeVisible();
  });

  test('signing out in one tab signs out the other', async ({ cast }) => {
    const nusrat = await cast.passenger('Nusrat');
    const first = await nusrat.open('/passenger');
    const second = await first.context().newPage();
    await second.goto('/passenger');
    await expect(second.getByRole('heading', { name: 'Hi Nusrat' })).toBeVisible();

    await first.getByRole('button', { name: 'Sign out' }).click();
    await expect(second).toHaveURL(/\/login/);
  });
});
