import type { Database } from '../types';
import { normalizeRichDoc, plainTextToDoc, richTextPlain } from '../content/rich-text';
export const STORAGE = 'liquid247:mock-db:v2';
export const LEGACY_STORAGE = 'liquid247:mock-db:v1';
export function migrateDatabase(value: Database): Database {
  if (![1, 2].includes(value.version) || !Array.isArray(value.alerts))
    throw new Error('不支持的演示数据版本');
  const db = structuredClone(value);
  const legacy = db.version === 1;
  for (const alert of db.alerts) {
    if (legacy) {
      const old = alert.status;
      alert.status =
        old === 'published' ? 'published' : old === 'unpublished' ? 'offline' : 'unpublished';
      alert.scheduled_at = old === 'scheduled' ? alert.time : null;
      if (!['published', 'unpublished'].includes(old)) alert.time = null;
    }
    try {
      alert.body_doc = normalizeRichDoc(alert.body_doc);
    } catch {
      alert.body_doc = plainTextToDoc(alert.body || '');
    }
    alert.body = richTextPlain(alert.body_doc);
    alert.scheduled_at = alert.scheduled_at || null;
  }
  db.version = 2;
  return db;
}
