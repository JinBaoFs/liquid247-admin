import { expect, test } from '@playwright/test';
import { login, request } from './helpers';
test('富文本格式保存、预览与三种发布状态闭环', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await page.goto('/admin/alerts/new');
  await page.getByLabel('标题', { exact: true }).fill('富文本验证 · BTC 近端盘口');
  const editor = page.getByRole('textbox', { name: '正文', exact: true });
  await editor.fill('观察正文');
  await page.getByRole('button', { name: '加粗', exact: true }).click();
  await editor.press('End');
  await editor.pressSequentially('重点信息');
  await expect(editor.locator('strong')).toHaveText('重点信息');
  await page.getByRole('button', { name: '加粗', exact: true }).click();
  await page.getByRole('button', { name: '保存情报', exact: true }).click();
  await expect(page).toHaveURL(/alerts\/\d+$/);
  const id = page.url().split('/').pop()!;
  await expect(page.locator('.publish-status .status')).toHaveText('未发布');
  const saved = (await request(page, 'alerts/' + id)).data;
  expect(saved.time).toBeNull();
  expect(saved.body).toContain('重点信息');
  expect(JSON.stringify(saved.body_doc)).toContain('bold');
  await page.reload();
  await expect(editor.locator('strong')).toHaveText('重点信息');
  await page.getByRole('button', { name: '前台预览' }).click();
  await expect(page.getByRole('dialog').locator('.rich-content strong')).toHaveText('重点信息');
  await page.getByRole('button', { name: '关闭预览' }).click();
  await page.screenshot({ path: '.artifacts/rich-editor.png', fullPage: true });
  await page.getByRole('button', { name: '立即发布', exact: true }).click();
  await expect(page.locator('.publish-status .status')).toHaveText('已发布');
  await expect(page.getByRole('button', { name: '保存并更新', exact: true })).toBeVisible();
  await page.getByLabel('标题', { exact: true }).fill('更新后的已发布富文本情报');
  await page.getByRole('button', { name: '保存并更新', exact: true }).click();
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const r = await fetch('/api/alerts/' + id);
        return (await r.json()).headline;
      }, id),
    )
    .toBe('更新后的已发布富文本情报');
  await page.getByRole('button', { name: '下架情报' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '下架', exact: true }).click();
  await expect(page.locator('.publish-status .status')).toHaveText('已下架');
  expect((await request(page, 'alerts/' + id)).data.status).toBe('offline');
  expect(await page.evaluate(async (id) => (await fetch('/api/alerts/' + id)).status, id)).toBe(
    404,
  );
  await page.getByRole('button', { name: '再次发布', exact: true }).click();
  await expect(page.locator('.publish-status .status')).toHaveText('已发布');
  expect((await request(page, 'alerts/' + id)).data.id).toBe(Number(id));
  await page.goto('/admin/alerts');
  await page
    .locator('.filter-field')
    .filter({ has: page.locator('label', { hasText: '发布状态' }) })
    .locator('.ant-select')
    .click();
  await expect(page.locator('.ant-select-dropdown .ant-select-item-option-content')).toHaveText([
    '已发布',
    '未发布',
    '已下架',
  ]);
  expect(errors).toEqual([]);
});
test('空格式正文阻止保存，链接协议校验正确', async ({ page }) => {
  await login(page);
  await page.goto('/admin/alerts/new');
  await page.getByLabel('标题', { exact: true }).fill('空正文验证');
  await page.getByRole('button', { name: '分隔线', exact: true }).click();
  await page.getByRole('button', { name: '保存情报', exact: true }).click();
  await expect(
    page.getByText('请输入正文内容，空段落或仅格式内容不能保存', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/alerts\/new$/);
  await page.getByRole('button', { name: '插入链接', exact: true }).click();
  await page.getByLabel('链接地址').fill('javascript:alert(1)');
  await page.getByRole('button', { name: '应用链接' }).click();
  await expect(page.getByText('请输入 http://、https:// 或 mailto: 开头的有效链接')).toBeVisible();
  await page.getByLabel('链接地址').fill('https://example.com');
  await page.getByRole('button', { name: '应用链接' }).click();
  await expect(
    page.getByRole('textbox', { name: '正文', exact: true }).locator('a'),
  ).toHaveAttribute('href', 'https://example.com');
});
test('定时发布保持未发布，可取消，执行时记录实际发布时间', async ({ page }) => {
  await login(page);
  const created = await request(page, 'alerts', 'POST', {
    headline: '定时发布验证',
    body: 'Binance 现货盘口观察',
    token: 'BTC',
    type: 'wall',
  });
  const id = created.data.id;
  expect(created.data.status).toBe('unpublished');
  const future = new Date(Date.now() + 3600000).toISOString();
  expect(
    (await request(page, 'alerts/' + id + '/schedule', 'POST', { scheduled_at: future })).status,
  ).toBe(200);
  await page.goto('/admin/alerts/' + id);
  await expect(page.locator('.publish-status .status')).toHaveText('未发布');
  await expect(page.locator('.schedule-card')).toContainText('待执行的发布安排');
  await page.getByRole('button', { name: '取消定时发布' }).click();
  await page.getByRole('button', { name: '取消安排' }).click();
  await expect(page.locator('.schedule-card')).toHaveCount(0);
  expect((await request(page, 'alerts/' + id)).data.scheduled_at).toBeNull();
  expect(
    (
      await request(page, 'alerts/' + id + '/schedule', 'POST', {
        scheduled_at: new Date(0).toISOString(),
      })
    ).status,
  ).toBe(400);
  const due = new Date(Date.now() + 2000).toISOString();
  await request(page, 'alerts/' + id + '/schedule', 'POST', { scheduled_at: due });
  await expect
    .poll(async () => (await request(page, 'alerts/' + id)).data.status, { timeout: 10000 })
    .toBe('published');
  const published = (await request(page, 'alerts/' + id)).data;
  expect(published.scheduled_at).toBeNull();
  expect(new Date(published.time).getTime()).toBeGreaterThanOrEqual(new Date(due).getTime());
  const audit = await request(page, 'audit?object_id=' + id + '&pageSize=200');
  expect(audit.data.items.some((a: any) => a.action === '取消定时发布')).toBe(true);
  expect(audit.data.items.some((a: any) => a.action === '定时发布')).toBe(true);
});
test('浏览器自动迁移旧数据，旧已下架不会变成未发布', async ({ page }) => {
  await login(page);
  const before = await page.evaluate(() => {
    const original = JSON.parse(localStorage.getItem('liquid247:mock-db:v2')!);
    original.version = 1;
    const states = ['draft', 'saved', 'scheduled', 'published', 'unpublished'];
    original.alerts = original.alerts
      .slice(0, 5)
      .map((a: any, i: number) => ({
        ...a,
        status: states[i],
        time: new Date(Date.now() + 3600000).toISOString(),
        body_doc: undefined,
        body: '历史情报正文\n第二段',
      }));
    original.users[0].nickname = '迁移保留的用户';
    localStorage.setItem('liquid247:mock-db:v1', JSON.stringify(original));
    localStorage.removeItem('liquid247:mock-db:v2');
    return { ids: original.alerts.map((a: any) => a.id), audit: original.audit };
  });
  await page.reload();
  await expect(page.locator('nav')).toBeVisible();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('liquid247:mock-db:v2')!),
  );
  expect(after.version).toBe(2);
  expect(after.alerts.map((a: any) => a.status)).toEqual([
    'unpublished',
    'unpublished',
    'unpublished',
    'published',
    'offline',
  ]);
  expect(after.alerts.map((a: any) => a.id)).toEqual(before.ids);
  expect(after.alerts[2].scheduled_at).toBeTruthy();
  expect(after.alerts[2].time).toBeNull();
  expect(after.users[0].nickname).toBe('迁移保留的用户');
  expect(after.audit).toEqual(before.audit);
  expect(await page.evaluate(() => !!localStorage.getItem('liquid247:mock-db:v1'))).toBe(true);
  await page.goto('/admin/alerts/' + before.ids[4]);
  await expect(page.locator('.publish-status .status')).toHaveText('已下架');
  await expect(page.getByRole('textbox', { name: '正文', exact: true })).toContainText(
    '历史情报正文',
  );
});
