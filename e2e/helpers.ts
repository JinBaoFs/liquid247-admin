import { expect, type Page } from '@playwright/test';
export const login = async (page: Page, role = 'super') => {
  await page.goto('/admin/login');
  if (role === 'content') await page.getByText('内容管理员', { exact: true }).click();
  await page.getByRole('button', { name: '登录工作台' }).click();
  await expect(page.locator('nav')).toBeVisible();
};
export const request = async (page: Page, path: string, method = 'GET', body?: unknown) =>
  page.evaluate(
    async ({ path, method, body }) => {
      const session = JSON.parse(localStorage.getItem('liquid247:admin-session')!);
      const response = await fetch('/api/admin/' + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    },
    { path, method, body },
  );
