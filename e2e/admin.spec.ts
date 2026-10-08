import { expect, test } from '@playwright/test';
import { login, request } from './helpers';
test('超管：全页面、发布闭环、审计、持久化与密码重置', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByRole('heading', { name: '值班总览', exact: true })).toBeVisible();
  await expect(page.locator('.metric-value').first()).not.toHaveText('0次');
  await page.screenshot({ path: '.artifacts/overview.png', fullPage: true });
  for (const [path, title] of [
    ['glossary', '术语库'],
    ['tokens', '监测池'],
    ['whales', '巨鲸名单'],
    ['links', '链接数据'],
    ['nodes', '延迟检测'],
    ['users', '前台用户'],
    ['accounts', '后台账号'],
    ['audit', '操作日志'],
  ]) {
    await page.goto('/admin/' + path);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.ant-table-tbody .ant-table-row').first()).toBeVisible();
  }
  await page.goto('/admin/alerts/new');
  await page.getByLabel('标题', { exact: true }).fill('浏览器验证 · BTC 近端盘口观察');
  await page
    .getByRole('textbox', { name: '正文', exact: true })
    .fill('Binance 现货近端盘口出现买单墙，测试保存与发布流程。');
  await page.getByRole('button', { name: '保存情报' }).click();
  await expect(page).toHaveURL(/alerts\/\d+$/);
  const id = page.url().split('/').pop()!;
  await page.getByRole('button', { name: '立即发布' }).click();
  await expect(page.locator('.publish-status .status')).toHaveText('已发布');
  await page.reload();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue(
    '浏览器验证 · BTC 近端盘口观察',
  );
  await page.getByRole('button', { name: '下架情报', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /下\s*架/ })
    .click();
  await expect(page.locator('.publish-status .status')).toHaveText('已下架');
  const logs = await request(page, 'audit?object_id=' + id + '&pageSize=200');
  expect(logs.data.items.some((r: any) => r.action === '发布情报')).toBe(true);
  expect(logs.data.items.some((r: any) => r.action === '下架情报')).toBe(true);
  const reset = await request(page, 'users/100001/reset-password', 'POST', {});
  expect(reset.data.temporaryPassword).toBeTruthy();
  const audit = await request(page, 'audit?object_id=100001');
  expect(JSON.stringify(audit.data)).not.toContain(reset.data.temporaryPassword);
  expect(audit.data.items[0].after.result).toBe('已重置');
  await page.goto('/admin/alerts');
  await expect(page.getByRole('heading', { name: '情报工作台', exact: true })).toBeVisible();
  await page.screenshot({ path: '.artifacts/alerts.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/overview');
  await expect(page.getByRole('heading', { name: '值班总览', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.artifacts/mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('内容管理员：隐藏未授权导航，接口与直接路由均拒绝越权', async ({ page }) => {
  await login(page, 'content');
  await expect(page.locator('nav').getByText('前台用户', { exact: true })).toHaveCount(0);
  await expect(page.locator('nav').getByText('后台账号', { exact: true })).toHaveCount(0);
  await page.goto('/admin/accounts');
  await expect(page.getByRole('heading', { name: '没有访问权限' })).toBeVisible();
  expect((await request(page, 'accounts')).status).toBe(403);
  expect((await request(page, 'users/100001/toggle', 'POST', {})).status).toBe(403);
  expect((await request(page, 'alerts/2293369', 'DELETE')).status).toBe(403);
});
test('加池：失败禁入、成功凭证绑定品种与交易对；snapshot不可修改', async ({ page }) => {
  await login(page);
  const failed = await request(page, 'tokens/probe', 'POST', {
    symbol: 'ARB',
    pair: 'ARBUSDT',
    scenario: 'failed',
  });
  expect(failed.data.passed).toBe(false);
  expect(
    (await request(page, 'tokens', 'POST', { symbol: 'ARB', pair: 'ARBUSDT', name: 'Arbitrum' }))
      .status,
  ).toBe(400);
  const probe = await request(page, 'tokens/probe', 'POST', {
    symbol: 'ARB',
    pair: 'ARBUSDT',
    scenario: 'success',
  });
  expect(probe.data.passed).toBe(true);
  expect(
    (
      await request(page, 'tokens', 'POST', {
        symbol: 'OP',
        pair: 'OPUSDT',
        name: 'Optimism',
        proof: probe.data.proof,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(page, 'tokens', 'POST', {
        symbol: 'ARB',
        pair: 'ARBUSDT',
        name: 'Arbitrum',
        world: 'crypto',
        proof: probe.data.proof,
      })
    ).status,
  ).toBe(201);
  const before = (await request(page, 'alerts/2293369')).data.snapshot;
  await request(page, 'alerts/2293369', 'PATCH', { snapshot: { price: 0 } });
  expect((await request(page, 'alerts/2293369')).data.snapshot).toEqual(before);
  await page.goto('/admin/tokens');
  await page.getByRole('button', { name: '增加品种' }).click();
  await page.getByLabel('Symbol', { exact: true }).fill('OP');
  await page.getByLabel('名称', { exact: true }).fill('Optimism');
  await page.getByLabel('交易对', { exact: true }).fill('OPUSDT');
  await expect(page.getByRole('button', { name: '确认加入' })).toBeDisabled();
  await page.getByRole('button', { name: '测试数据链接' }).click();
  await expect(page.getByRole('button', { name: '确认加入' })).toBeEnabled();
  await page.getByLabel('交易对', { exact: true }).fill('OPUSDC');
  await expect(page.getByRole('button', { name: '确认加入' })).toBeDisabled();
});

test('授权变更与停用账号即时作用于模拟接口', async ({ page }) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const current = JSON.parse(localStorage.getItem('liquid247:admin-session')!);
    const call = async (path: string, token: string, method = 'GET', body?: unknown) => {
      const response = await fetch('/api/admin/' + path, {
        method,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, data: await response.json() };
    };
    const editor = await call('auth/login', '', 'POST', {
      email: 'editor@liquid247.xyz',
      password: 'Demo247!',
    });
    await call('permissions', current.token, 'PATCH', {
      permissions: ['content', 'website', 'overview', 'users', 'system'],
    });
    const users = await call('users', editor.data.token);
    const accounts = await call('accounts', editor.data.token);
    await call('accounts/2/toggle', current.token, 'POST', {});
    const invalid = await call('auth/me', editor.data.token);
    return { users: users.status, accounts: accounts.status, invalid: invalid.status };
  });
  expect(result).toEqual({ users: 200, accounts: 403, invalid: 401 });
});

test('巨鲸筛选校验与场所关联正确', async ({ page }) => {
  await login(page);
  await page.goto('/admin/whales');
  await page.getByPlaceholder('最低胜率').fill('90');
  await page.getByPlaceholder('最高胜率').fill('20');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('最低胜率不能高于最高胜率');
  await page.getByRole('button', { name: '知道了' }).click();
  const row = await request(page, 'whales', 'POST', {
    address: 'venue-account-101',
    venue: 'OKX 现货',
    venue_id: 4,
    win_rate: null,
    pnl_30d: 0,
  });
  expect(row.status).toBe(201);
  const result = await request(page, 'whales?winMin=0&pageSize=200');
  expect(result.data.items.some((w: any) => w.id === row.data.id)).toBe(false);
});
