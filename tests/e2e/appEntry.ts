import { expect, type Page } from '@playwright/test'

export async function enterMainMenu(page: Page): Promise<void> {
  const soloStart = page.getByTestId('solo-start')
  if (await soloStart.isVisible()) {
    return
  }

  const splashStart = page.getByTestId('splash-start')
  await expect(splashStart).toBeVisible()
  await splashStart.click()
  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(soloStart).toBeVisible()
  await expect(page.getByTestId('splash-screen')).toHaveCount(0)
}
