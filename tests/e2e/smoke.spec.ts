import { expect, test } from '@playwright/test';

/**
 * Smoke test: an unauthenticated visit to a protected route must be redirected
 * to Clerk's sign-in. This validates that `clerkMiddleware` + `auth.protect()`
 * are wired correctly end to end.
 */
test('unauthenticated user is redirected to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
});
