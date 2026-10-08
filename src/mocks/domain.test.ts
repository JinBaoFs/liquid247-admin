import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { audit, authorize, canAutoPublish, dashboard, selectRows, transitionAlert } from './domain';
describe('后台业务边界', () => {
  it('业务主键与审计对象均为正整数', () => {
    const db = createSeed();
    for (const key of [
      'alerts',
      'glossary',
      'tokens',
      'whales',
      'links',
      'nodes',
      'users',
      'accounts',
      'audit',
    ] as const)
      for (const row of db[key]) expect(Number.isSafeInteger(row.id) && row.id > 0).toBe(true);
  });
  it('内容管理员系统授权不能开放后台账号', () => {
    const db = createSeed();
    db.permissions.push('system');
    expect(() => authorize(db, db.accounts[1], 'system')).not.toThrow();
    expect(() => authorize(db, db.accounts[1], 'system', true)).toThrow('仅超级管理员');
    expect(() => authorize(db, db.accounts[1], 'users')).toThrow('没有该板块');
  });
  it('停用账号拒绝访问', () => {
    const db = createSeed();
    db.accounts[0].enabled = false;
    expect(() => authorize(db, db.accounts[0], 'content')).toThrow('停用');
  });
  it('发布、下架、再发布保留稳定 ID 与冻结快照', () => {
    const db = createSeed();
    const row = db.alerts.find((a) => a.status === 'unpublished')!;
    const before = structuredClone(row.snapshot);
    const id = row.id;
    transitionAlert(row, 'publish', db);
    expect(row.status).toBe('published');
    transitionAlert(row, 'unpublish', db);
    expect(row.status).toBe('offline');
    transitionAlert(row, 'publish', db);
    expect(row.id).toBe(id);
    expect(row.snapshot).toEqual(before);
    expect(row.everPublished).toBe(true);
  });
  it('三种状态下发布校验与定时安排独立', () => {
    const db = createSeed();
    const row = db.alerts.find((a) => a.status === 'unpublished')!;
    transitionAlert(row, 'schedule', db, {
      scheduled_at: new Date(Date.now() + 60000).toISOString(),
    });
    expect(row.status).toBe('unpublished');
    expect(row.time).toBeNull();
    expect(row.scheduled_at).toBeTruthy();
    transitionAlert(row, 'cancel-schedule', db);
    expect(row.scheduled_at).toBeNull();
    expect(() =>
      transitionAlert(row, 'schedule', db, { scheduled_at: new Date(0).toISOString() }),
    ).toThrow('晚于当前');
    transitionAlert(row, 'publish', db);
    expect(() => transitionAlert(row, 'publish', db)).toThrow('只有未发布');
    row.status = 'unpublished';
    row.body = '';
    expect(() => transitionAlert(row, 'publish', db)).toThrow('完整填写');
  });
  it('胜率筛选排除未标注地址，最近动作来自关联情报', () => {
    const db = createSeed();
    const result = selectRows(db, 'whales', { winMin: '0', pageSize: '200' });
    expect(result.items.every((w) => w.win_rate !== null)).toBe(true);
    for (const w of result.items)
      if (w.recent)
        expect(db.alerts.find((a) => a.id === w.recent.id)?.headline).toBe(w.recent.headline);
  });
  it('总览日期口径正确：每日 UV 求和、活跃回看30天、注册截至结束日', () => {
    const db = createSeed();
    db.daily = [
      { id: 1, date: '2026-10-01', pv: 100, uv: 30, favorites: 5 },
      { id: 2, date: '2026-10-02', pv: 200, uv: 40, favorites: 8 },
    ];
    db.alerts = [
      { id: 1, time: '2026-10-01T12:00:00', status: 'published', type: 'wall' },
      { id: 2, time: '2026-10-02T12:00:00', status: 'unpublished', type: 'wall' },
    ];
    db.users = [
      {
        id: 1,
        registered_at: '2026-08-01T00:00:00',
        last_login_at: '2026-09-10T12:00:00',
        status: 'active',
      },
      {
        id: 2,
        registered_at: '2026-08-01T00:00:00',
        last_login_at: '2026-09-10T12:00:00',
        status: 'disabled',
      },
      {
        id: 3,
        registered_at: '2026-10-03T00:00:00',
        last_login_at: '2026-10-03T12:00:00',
        status: 'active',
      },
      {
        id: 4,
        registered_at: '2026-08-01T00:00:00',
        last_login_at: '2026-08-10T12:00:00',
        status: 'active',
      },
    ];
    const result = dashboard(db, '2026-10-01', '2026-10-02');
    expect(result).toMatchObject({
      pv: 300,
      uv: 70,
      published: 1,
      active: 1,
      registered: 3,
      favorites: 13,
    });
    expect(result.daily).toHaveLength(2);
  });
  it('禁用品种、数据链接或异常节点时暂停自动发布', () => {
    const db = createSeed();
    const row = db.alerts.find((a) => a.token === 'BTC' && a.venues[0] === 'Binance 现货')!;
    expect(canAutoPublish(db, row)).toBe(true);
    db.tokens.find((t) => t.symbol === 'BTC')!.status = 'disabled';
    expect(canAutoPublish(db, row)).toBe(false);
    db.tokens.find((t) => t.symbol === 'BTC')!.status = 'active';
    db.links[0].enabled = false;
    expect(canAutoPublish(db, row)).toBe(false);
    db.links[0].enabled = true;
    db.nodes[0].status = 'down';
    expect(canAutoPublish(db, row)).toBe(false);
    db.nodeConfig.policy = 'manual';
    expect(canAutoPublish(db, row)).toBe(true);
  });
  it('异常节点下人工发布保留数据延迟标记', () => {
    const db = createSeed();
    const row = db.alerts.find(
      (a) => a.status === 'unpublished' && a.venues[0] === 'Binance 现货',
    )!;
    db.nodes[0].status = 'degraded';
    transitionAlert(row, 'publish', db);
    expect(row.dataDelayed).toBe(true);
    expect(row.status).toBe('published');
  });
  it('发布与用户状态变更记录前后状态', () => {
    const db = createSeed();
    audit(db, db.accounts[0], '发布情报', 2293369, { status: 'saved' }, { status: 'published' });
    expect(db.audit[0]).toMatchObject({
      object_id: 2293369,
      action: '发布情报',
      before: { status: 'saved' },
      after: { status: 'published' },
    });
  });
});
