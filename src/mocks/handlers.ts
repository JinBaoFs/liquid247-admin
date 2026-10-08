import { http, HttpResponse } from 'msw';
import { createSeed } from './seed';
import {
  ApiError,
  audit,
  authorize,
  canAutoPublish,
  dashboard,
  modulesFor,
  nextId,
  selectRows,
  transitionAlert,
} from './domain';
import { ALERT_TYPES, type Database, type Module, type Row } from '../types';
import { STORAGE, LEGACY_STORAGE, migrateDatabase } from './migrate';
import { normalizeRichDoc, plainTextToDoc, richTextPlain } from '../content/rich-text';
let memory: Database | undefined;
const proofs = new Map<string, { symbol: string; pair: string }>();
export function getDB(): Database {
  try {
    const current = localStorage.getItem(STORAGE);
    const legacy = current ? null : localStorage.getItem(LEGACY_STORAGE);
    const value = JSON.parse(current || legacy || 'null');
    memory =
      value?.version === 2
        ? value
        : value?.version === 1
          ? migrateDatabase(value)
          : memory || createSeed();
    if (!current) persist(memory!);
  } catch {
    memory = memory || createSeed();
    persist(memory!);
  }
  const db = memory!;
  let changed = false;
  for (const alert of db.alerts)
    if (
      alert.status === 'unpublished' &&
      alert.scheduled_at &&
      new Date(alert.scheduled_at).getTime() <= Date.now() &&
      canAutoPublish(db, alert)
    ) {
      const before = { status: alert.status, scheduled_at: alert.scheduled_at };
      transitionAlert(alert, 'publish', db);
      audit(
        db,
        db.accounts[0],
        '定时发布',
        alert.id,
        before,
        { status: alert.status, time: alert.time, scheduled_at: null },
        '模拟定时任务',
      );
      changed = true;
    }
  if (changed) persist(db);
  return db;
}
function persist(db: Database) {
  memory = db;
  localStorage.setItem(STORAGE, JSON.stringify(db));
}
function json(value: any, status = 200) {
  return HttpResponse.json(value, { status });
}
const resourceModules: Record<string, Module> = {
  alerts: 'content',
  glossary: 'content',
  tokens: 'website',
  whales: 'website',
  links: 'website',
  nodes: 'overview',
  dashboard: 'overview',
  users: 'users',
  accounts: 'system',
  permissions: 'system',
  audit: 'system',
};
const copy = (value: unknown) => JSON.parse(JSON.stringify(value));
const fields: Record<string, string[]> = {
  alerts: ['type', 'token', 'headline', 'body', 'body_doc', 'insight'],
  glossary: ['term', 'name', 'cat', 'def', 'read', 'status'],
  tokens: ['symbol', 'name', 'pair', 'world'],
  whales: ['address', 'label', 'venue_id', 'venue', 'win_rate', 'pnl_30d'],
  links: ['name', 'kind', 'url', 'venue', 'secretRef'],
  accounts: ['email', 'name'],
};
const pick = (resource: string, body: Record<string, unknown>) =>
  Object.fromEntries(
    (fields[resource] || []).filter((k) => body[k] !== undefined).map((k) => [k, body[k]]),
  );
function requireFields(body: Record<string, unknown>, names: string[]) {
  if (names.some((k) => typeof body[k] !== 'string' || !String(body[k]).trim()))
    throw new ApiError(400, '请完整填写必填字段');
}
function contentValues(body: Record<string, any>) {
  try {
    const body_doc =
      body.body_doc !== undefined
        ? normalizeRichDoc(body.body_doc)
        : plainTextToDoc(body.body || '');
    const text = richTextPlain(body_doc);
    if (!text.replace(/[\s\u200B-\u200D\uFEFF]/g, '')) throw new Error('正文不能为空');
    return { body_doc, body: text };
  } catch (error) {
    throw new ApiError(400, error instanceof Error ? error.message : '正文格式无效');
  }
}
export const handlers = [
  http.all('/api/admin/*', async ({ request }) => {
    await new Promise((r) => setTimeout(r, 180));
    try {
      const db = getDB();
      const path = new URL(request.url).pathname.replace('/api/admin/', '').split('/');
      const [resource, idString, action] = path;
      const method = request.method;
      const body: Record<string, any> =
        method === 'GET' || method === 'DELETE'
          ? {}
          : ((await request.json()) as Record<string, any>);
      if (resource === 'auth' && idString === 'login' && method === 'POST') {
        const account = db.accounts.find(
          (a) => a.email.toLowerCase() === String(body.email).trim().toLowerCase(),
        );
        if (!account || body.password !== 'Demo247!') throw new ApiError(401, '邮箱或演示密码错误');
        if (!account.enabled) throw new ApiError(401, '该后台账号已停用');
        const token = crypto.randomUUID();
        db.sessions[token] = account.id;
        persist(db);
        return json({ token, account, permissions: modulesFor(db, account) });
      }
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
      const account = db.accounts.find((a) => a.id === db.sessions[token]);
      if (!account || !account.enabled) throw new ApiError(401, '会话已失效，请重新登录');
      if (resource === 'auth' && idString === 'me')
        return json({ token, account, permissions: modulesFor(db, account) });
      if (resource === 'auth' && idString === 'logout') {
        delete db.sessions[token];
        persist(db);
        return json({ ok: true });
      }
      if (resource === 'demo' && idString === 'reset' && method === 'POST') {
        const fresh = createSeed();
        if (fresh.accounts.some((a) => a.id === account.id)) fresh.sessions[token] = account.id;
        persist(fresh);
        return json({ ok: true });
      }
      const module = resourceModules[resource];
      if (!module) throw new ApiError(404, '接口不存在');
      authorize(db, account, module, resource === 'accounts' || resource === 'permissions');
      if (resource === 'dashboard') {
        const q = new URL(request.url).searchParams;
        return json(
          dashboard(
            db,
            q.get('start') || new Date().toISOString().slice(0, 10),
            q.get('end') || new Date().toISOString().slice(0, 10),
          ),
        );
      }
      if (resource === 'permissions') {
        if (method === 'GET') return json(db.permissions);
        const before = copy(db.permissions);
        db.permissions = body.permissions.filter((p: Module) =>
          ['content', 'website', 'overview', 'users', 'system'].includes(p),
        );
        audit(db, account, '修改板块授权', 2, before, db.permissions);
        persist(db);
        return json(db.permissions);
      }
      if (resource === 'nodes' && idString === 'config') {
        if (method === 'GET') return json(db.nodeConfig);
        if (
          !Number.isInteger(body.interval) ||
          body.interval < 5 ||
          body.interval > 300 ||
          !(body.latencyThreshold > 0) ||
          !(body.degradedAfter > 0) ||
          !(body.downAfter > body.degradedAfter) ||
          !['stop', 'manual'].includes(body.policy)
        )
          throw new ApiError(400, '请检查探测间隔与异常阈值');
        const before = copy(db.nodeConfig);
        db.nodeConfig = {
          interval: body.interval,
          latencyThreshold: body.latencyThreshold,
          degradedAfter: body.degradedAfter,
          downAfter: body.downAfter,
          policy: body.policy,
        };
        audit(db, account, '修改延迟检测配置', 1, before, db.nodeConfig);
        persist(db);
        return json(db.nodeConfig);
      }
      if (resource === 'nodes' && idString === 'batch-probe' && method === 'POST') {
        const phase = Math.floor(Date.now() / (db.nodeConfig.interval * 1000));
        for (const node of db.nodes) {
          node.latency = 35 + ((phase * 7 + node.id * 19) % 240);
          node.heartbeatAge = node.id === 6 && phase % 3 === 0 ? 70 : node.id === 4 ? 12 : 1;
          node.status =
            node.heartbeatAge > db.nodeConfig.downAfter
              ? 'down'
              : node.heartbeatAge > db.nodeConfig.degradedAfter ||
                  node.latency > db.nodeConfig.latencyThreshold
                ? 'degraded'
                : 'active';
          node.lastChecked = new Date().toISOString();
        }
        persist(db);
        return json({ ok: true });
      }
      if (resource === 'tokens' && idString === 'probe' && method === 'POST') {
        requireFields(body, ['symbol', 'pair']);
        if (body.scenario === 'timeout') throw new ApiError(408, '模拟探测超时，请重试');
        if (body.scenario === 'failed')
          return json({ passed: false, message: '模拟行情源未返回有效现价' });
        const proof = crypto.randomUUID();
        proofs.set(proof, { symbol: body.symbol.toUpperCase(), pair: body.pair.toUpperCase() });
        return json({
          passed: true,
          proof,
          price: body.symbol.toUpperCase() === 'BTC' ? 62480.5 : 148.73,
          source: '模拟 Binance / Hyperliquid',
          checkedAt: new Date().toISOString(),
        });
      }
      const rows = db[resource as keyof Database] as Row[];
      if (!Array.isArray(rows)) throw new ApiError(404, '资源不存在');
      if (!idString && method === 'GET') {
        return json(
          selectRows(
            db,
            resource as keyof Database,
            Object.fromEntries(new URL(request.url).searchParams),
          ),
        );
      }
      if (!idString && method === 'POST') {
        if (!fields[resource]) throw new ApiError(405, '该资源不支持新增');
        const values = pick(resource, body);
        if (resource === 'alerts') {
          requireFields(body, ['headline', 'type', 'token']);
          Object.assign(values, contentValues(body));
          if (!db.tokens.some((t) => t.symbol === body.token && t.status === 'active'))
            throw new ApiError(400, '请选择启用中的监测品种');
          if (!(body.type in ALERT_TYPES)) throw new ApiError(400, '无效情报类型');
        }
        if (resource === 'glossary') requireFields(body, ['term', 'name', 'cat', 'def', 'read']);
        if (resource === 'links') requireFields(body, ['name', 'kind', 'url', 'venue']);
        if (resource === 'whales') {
          requireFields(body, ['address', 'venue']);
          if (db.whales.some((w) => w.address === body.address))
            throw new ApiError(400, '该地址已在名单中');
        }
        if (resource === 'tokens') {
          requireFields(body, ['symbol', 'name', 'pair']);
          const proof = proofs.get(body.proof);
          if (
            !proof ||
            proof.symbol !== body.symbol.toUpperCase() ||
            proof.pair !== body.pair.toUpperCase()
          )
            throw new ApiError(400, '请先完成数据链接探测，修改品种或交易对后需重新探测');
          if (db.tokens.some((t) => t.symbol === body.symbol.toUpperCase()))
            throw new ApiError(400, '该品种已在监测池中');
          proofs.delete(body.proof);
          values.symbol = body.symbol.toUpperCase();
          values.pair = body.pair.toUpperCase();
        }
        if (resource === 'accounts') {
          requireFields(body, ['email', 'name']);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
            throw new ApiError(400, '邮箱格式不正确');
          if (db.accounts.some((a) => a.email === body.email))
            throw new ApiError(400, '邮箱已存在');
        }
        const row = {
          id: Math.max(
            nextId(rows),
            resource === 'alerts' ? 2293369 : resource === 'whales' ? 1001 : 1,
          ),
          ...values,
        };
        Object.assign(
          row,
          resource === 'alerts'
            ? {
                status: 'unpublished',
                clicks: 0,
                favorites: 0,
                everPublished: false,
                archived: false,
                time: null,
                scheduled_at: null,
                updated_at: new Date().toISOString(),
                snapshot: null,
                venues: ['Binance 现货'],
                exchange_id: 1,
                related: [],
                whale_id: null,
              }
            : resource === 'accounts'
              ? { role: 'content', enabled: true }
              : resource === 'tokens'
                ? {
                    status: 'active',
                    assetClass: body.world === 'trad' ? 'commodity' : 'crypto',
                    unit: 'USD',
                  }
                : resource === 'links'
                  ? { enabled: true, probeStatus: 'untested', latency: null }
                  : {},
        );
        rows.push(row);
        audit(
          db,
          account,
          resource === 'tokens' ? '加入监测池' : '新增' + resource,
          row.id,
          null,
          row,
        );
        persist(db);
        return json(row, 201);
      }
      if (!/^\d+$/.test(idString || '')) throw new ApiError(400, '资源 ID 必须为纯数字');
      const row = rows.find((r) => r.id === Number(idString));
      if (!row) throw new ApiError(404, '记录不存在');
      if (method === 'GET')
        return json(
          resource === 'users'
            ? {
                ...row,
                savedAlerts: db.alerts
                  .filter((a) => row.saved.includes(a.id))
                  .map((a) => ({ id: a.id, headline: a.headline })),
              }
            : row,
        );
      const before = copy(row);
      let label = '编辑' + resource;
      if (method === 'DELETE') {
        if (!['alerts', 'glossary', 'whales', 'accounts'].includes(resource))
          throw new ApiError(405, '该资源不支持删除');
        authorize(db, account, module, resource === 'alerts' || resource === 'accounts');
        if (resource === 'accounts' && row.role === 'super')
          throw new ApiError(400, '不能删除超级管理员');
        if (resource === 'alerts' && row.everPublished) {
          transitionAlert(row, 'archive', db);
          label = '下架并归档情报';
        } else {
          rows.splice(rows.indexOf(row), 1);
          label = '删除' + resource;
        }
        if (resource === 'accounts')
          for (const [t, accountId] of Object.entries(db.sessions))
            if (accountId === row.id) delete db.sessions[t];
      } else if (action) {
        if (resource === 'alerts') {
          transitionAlert(row, action, db, { scheduled_at: body.scheduled_at });
          label =
            action === 'publish'
              ? '发布情报'
              : action === 'unpublish'
                ? '下架情报'
                : action === 'cancel-schedule'
                  ? '取消定时发布'
                  : '定时发布情报';
        } else if (
          action === 'toggle' &&
          ['tokens', 'links', 'users', 'accounts'].includes(resource)
        ) {
          if (resource === 'accounts' && row.id === account.id)
            throw new ApiError(400, '不能停用当前账号');
          if (resource === 'tokens' || resource === 'users')
            row.status = row.status === 'active' ? 'disabled' : 'active';
          else row.enabled = !row.enabled;
          label =
            (resource === 'users'
              ? '前台用户'
              : resource === 'tokens'
                ? '监测品种'
                : resource === 'accounts'
                  ? '后台账号'
                  : '数据链接') +
            (row.status === 'disabled' || row.enabled === false ? '停用' : '恢复');
          if (resource === 'accounts' && !row.enabled)
            for (const [t, accountId] of Object.entries(db.sessions))
              if (accountId === row.id) delete db.sessions[t];
        } else if (action === 'probe' && ['links', 'nodes'].includes(resource)) {
          const failed = body.scenario === 'failed';
          row.lastChecked = new Date().toISOString();
          row.latency = failed ? 0 : 35 + row.id * 17;
          if (resource === 'links') row.probeStatus = failed ? 'failed' : 'success';
          else {
            row.heartbeatAge = failed ? 70 : 1;
            row.status = failed
              ? 'down'
              : row.latency > db.nodeConfig.latencyThreshold
                ? 'degraded'
                : 'active';
          }
          label = '探测' + (resource === 'links' ? '数据链接' : '节点');
        } else if (resource === 'users' && action === 'reset-password') {
          audit(db, account, '找回密码', row.id, null, { result: '已重置' }, '临时密码仅展示一次');
          persist(db);
          return json({ temporaryPassword: 'Lq!' + crypto.randomUUID().slice(0, 8) });
        } else throw new ApiError(405, '不支持此操作');
      } else if (method === 'PATCH') {
        if (!fields[resource]) throw new ApiError(405, '该资源不支持编辑');
        const values = pick(resource, body);
        if (resource === 'alerts') {
          if (body.type && !(body.type in ALERT_TYPES)) throw new ApiError(400, '无效情报类型');
          if (
            body.token &&
            body.token !== row.token &&
            !db.tokens.some((t) => t.symbol === body.token && t.status === 'active')
          )
            throw new ApiError(400, '品种不在启用的监测池内');
          if (body.body_doc !== undefined || body.body !== undefined)
            Object.assign(values, contentValues(body));
          if (body.headline !== undefined && !String(body.headline).trim())
            throw new ApiError(400, '标题不能为空');
        }
        Object.assign(row, values);
        if (resource === 'alerts') {
          row.updated_at = new Date().toISOString();
          label = row.status === 'published' ? '保存并更新已发布情报' : '保存情报';
        }
      } else throw new ApiError(405, '不支持的请求方法');
      audit(
        db,
        account,
        label,
        row.id,
        before,
        method === 'DELETE' && !rows.includes(row) ? null : copy(row),
      );
      persist(db);
      return json({ ok: true, item: row });
    } catch (error) {
      return json(
        { message: error instanceof Error ? error.message : '模拟接口异常' },
        error instanceof ApiError ? error.status : 500,
      );
    }
  }),
  http.get('/api/alerts', () =>
    json(getDB().alerts.filter((a) => a.status === 'published' && !a.archived)),
  ),
  http.get('/api/alerts/:id', ({ params }) => {
    const row = getDB().alerts.find(
      (a) => a.id === Number(params.id) && a.status === 'published' && !a.archived,
    );
    return row ? json(row) : json({ message: '情报不存在' }, 404);
  }),
  http.get('/api/tokens', () => json(getDB().tokens.filter((t) => t.status === 'active'))),
  http.get('/api/whales', () => json(getDB().whales)),
  http.get('/api/glossary', () => json(getDB().glossary.filter((t) => t.status === 'published'))),
];
