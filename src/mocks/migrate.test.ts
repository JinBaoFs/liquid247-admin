import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { migrateDatabase } from './migrate';
describe('旧版数据迁移', () => {
  it('准确区分旧已下架与新未发布，并保留 ID、统计、快照和审计', () => {
    const old = createSeed();
    old.version = 1;
    const states = ['draft', 'saved', 'scheduled', 'published', 'unpublished'];
    const time = new Date(Date.now() + 3600000).toISOString();
    old.alerts = old.alerts
      .slice(0, 5)
      .map((a, i) => ({
        ...a,
        status: states[i],
        time,
        body_doc: undefined,
        body: '旧正文第一段\n\n第二段',
      }));
    old.audit[0].before = { status: 'unpublished' };
    const migrated = migrateDatabase(old);
    expect(migrated.version).toBe(2);
    expect(migrated.alerts.map((a) => a.status)).toEqual([
      'unpublished',
      'unpublished',
      'unpublished',
      'published',
      'offline',
    ]);
    expect(migrated.alerts[2].scheduled_at).toBe(time);
    expect(migrated.alerts[2].time).toBeNull();
    expect(migrated.alerts[4].time).toBe(time);
    for (const [i, a] of migrated.alerts.entries()) {
      expect(a.id).toBe(old.alerts[i].id);
      expect(a.clicks).toBe(old.alerts[i].clicks);
      expect(a.favorites).toBe(old.alerts[i].favorites);
      expect(a.snapshot).toEqual(old.alerts[i].snapshot);
      expect(a.body).toBe(old.alerts[i].body);
      expect(a.body_doc.content).toHaveLength(3);
    }
    expect(migrated.audit).toEqual(old.audit);
    expect(migrated.users).toEqual(old.users);
    expect(old.version).toBe(1);
  });
  it('迁移可重复执行，不把新未发布错误转换成已下架', () => {
    const db = createSeed();
    expect(migrateDatabase(migrateDatabase(db))).toEqual(migrateDatabase(db));
  });
});
