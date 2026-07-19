import { expect, test } from '@playwright/test'

test('loads the table shell and core controls', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Load' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await expect(page.getByTitle('Reset view')).toBeVisible()
  await expect(page.locator('[data-table-drop]')).toBeVisible()
})
