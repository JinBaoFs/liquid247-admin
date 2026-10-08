import { MODULES, type Account, type Database, type Module, type Row } from '../types';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function authorize(db: Database, account: Account, module: Module, superOnly = false) {
  if (!account.enabled) throw new ApiError(401, '账号已停用，请重新登录');
  if (superOnly && account.role !== 'super') throw new ApiError(403, '仅超级管理员可执行此操作');
  if (account.role !== 'super' && !db.permissions.includes(module))
    throw new ApiError(403, '你没有该板块的访问权限');
}
export function modulesFor(db: Database, account: Account): Module[] {
  return account.role === 'super' ? (Object.keys(MODULES) as Module[]) : db.permissions;
}
export function nextId(rows: Row[]) {
  return Math.max(0, ...rows.map((r) => r.id)) + 1;
}
export function audit(
  db: Database,
  account: Account,
  action: string,
  object: number,
  before: unknown,
  after: unknown,
  note = '',
) {
  db.audit.unshift({
    id: nextId(db.audit),
    time: new Date().toISOString(),
    account: account.name,
    email: account.email,
    role: account.role,
    action,
    object_id: object,
    before,
    after,
    note,
  });
}
export function transitionAlert(
  row: Row,
  action: string,
  db: Database,
  options: { scheduled_at?: string } = {},
) {
  if (action === 'publish') {
    if (!['unpublished', 'offline'].includes(row.status))
      throw new ApiError(400, '只有未发布或已下架情报可以发布');
    if (!String(row.headline || '').trim() || !String(row.body || '').trim())
      throw new ApiError(400, '请完整填写标题和正文后再发布');
    row.dataDelayed = db.nodes.some(
      (node) =>
        (row.venues || []).some((venue: string) => node.name.startsWith(venue)) &&
        node.status !== 'active',
    );
    row.status = 'published';
    row.time = new Date().toISOString();
    row.scheduled_at = null;
    row.everPublished = true;
    row.archived = false;
  } else if (action === 'unpublish') {
    if (row.status !== 'published') throw new ApiError(400, '只有已发布情报可以下架');
    row.status = 'offline';
    row.scheduled_at = null;
  } else if (action === 'schedule') {
    if (row.status !== 'unpublished') throw new ApiError(400, '只有未发布情报可以安排定时发布');
    if (
      !options.scheduled_at ||
      !Number.isFinite(new Date(options.scheduled_at).getTime()) ||
      new Date(options.scheduled_at).getTime() <= Date.now()
    )
      throw new ApiError(400, '定时发布时间必须晚于当前时间');
    if (!String(row.headline || '').trim() || !String(row.body || '').trim())
      throw new ApiError(400, '请完整填写标题和正文');
    row.scheduled_at = options.scheduled_at;
  } else if (action === 'cancel-schedule') {
    if (row.status !== 'unpublished' || !row.scheduled_at)
      throw new ApiError(400, '这条情报没有待执行的发布计划');
    row.scheduled_at = null;
  } else if (action === 'archive') {
    row.status = row.everPublished ? 'offline' : 'unpublished';
    row.scheduled_at = null;
    row.archived = true;
  } else throw new ApiError(400, '不支持的情报操作');
  row.updated_at = new Date().toISOString();
}
export function dashboard(db: Database, start: string, end: string) {
  const endTime = new Date(end + 'T23:59:59').getTime();
  const cutoff = endTime - 30 * 86400000;
  const days = db.daily.filter((d) => d.date >= start && d.date <= end);
  const inRange = (value: string) => {
    const date = value?.slice(0, 10);
    return date >= start && date <= end;
  };
  const published = db.alerts.filter((a) => a.status === 'published' && inRange(a.time));
  return {
    pv: days.reduce((s, d) => s + d.pv, 0),
    uv: days.reduce((s, d) => s + d.uv, 0),
    published: published.length,
    active: db.users.filter(
      (u) =>
        u.status === 'active' &&
        new Date(u.registered_at).getTime() <= endTime &&
        new Date(u.last_login_at).getTime() >= cutoff &&
        new Date(u.last_login_at).getTime() <= endTime,
    ).length,
    registered: db.users.filter((u) => new Date(u.registered_at).getTime() <= endTime).length,
    favorites: days.reduce((s, d) => s + d.favorites, 0),
    daily: days.map((d) => ({
      ...d,
      registrations: db.users.filter((u) => u.registered_at.slice(0, 10) === d.date).length,
    })),
    distribution: ['wall', 'sweep', 'spoof', 'gap', 'divergence', 'whale', 'depth'].map((type) => ({
      type,
      count: db.alerts.filter(
        (a) => !a.archived && a.status === 'published' && a.type === type && inRange(a.time),
      ).length,
    })),
  };
}
export function selectRows(
  db: Database,
  resource: keyof Database,
  filters: Record<string, string>,
) {
  let rows = [...(db[resource] as Row[])];
  if (resource === 'whales')
    rows = rows.map((w) => ({
      ...w,
      recent:
        db.alerts
          .filter((a) => a.whale_id === w.id && !a.archived)
          .sort((a, b) =>
            String(b.time || b.updated_at || '').localeCompare(
              String(a.time || a.updated_at || ''),
            ),
          )[0] ?? null,
    }));
  if (resource === 'accounts') rows = rows.map(({ ...a }) => a);
  rows = rows.filter((r) => {
    for (const [key, value] of Object.entries(filters)) {
      if (!value || ['page', 'pageSize'].includes(key)) continue;
      if (key === 'start' && (!r.time || r.time.slice(0, 10) < value)) return false;
      if (key === 'end' && (!r.time || r.time.slice(0, 10) > value)) return false;
      if (
        key === 'winMin' &&
        (r.win_rate === null || r.win_rate === undefined || r.win_rate < Number(value))
      )
        return false;
      if (
        key === 'winMax' &&
        (r.win_rate === null || r.win_rate === undefined || r.win_rate > Number(value))
      )
        return false;
      if (['start', 'end', 'winMin', 'winMax'].includes(key)) continue;
      if (['status', 'type', 'token', 'cat', 'role', 'kind'].includes(key)) {
        if (String(r[key]) !== value) return false;
      } else if (key === 'query') {
        if (
          !['term', 'name', 'symbol', 'pair'].some((k) =>
            String(r[k] ?? '')
              .toLowerCase()
              .includes(value.toLowerCase()),
          )
        )
          return false;
      } else if (
        !String(r[key] ?? '')
          .toLowerCase()
          .includes(value.toLowerCase())
      )
        return false;
    }
    return !r.archived;
  });
  if (resource === 'alerts')
    rows.sort((a, b) =>
      String(b.updated_at || b.time || '').localeCompare(String(a.updated_at || a.time || '')),
    );
  if (resource === 'audit') rows.sort((a, b) => b.id - a.id);
  const page = Math.max(1, Number(filters.page) || 1),
    size = Math.min(200, Math.max(1, Number(filters.pageSize) || 10));
  return { items: rows.slice((page - 1) * size, page * size), total: rows.length };
}

export function canAutoPublish(db: Database, row: Row) {
  if (!db.tokens.some((t) => t.symbol === row.token && t.status === 'active')) return false;
  const venues = row.venues || [];
  if (db.links.some((link) => venues.includes(link.venue) && !link.enabled)) return false;
  if (
    db.nodeConfig.policy === 'stop' &&
    db.nodes.some(
      (node) =>
        venues.some((venue: string) => node.name.startsWith(venue)) && node.status !== 'active',
    )
  )
    return false;
  return true;
}
