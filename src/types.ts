export const ALERT_TYPES = {
  wall: '限价单墙',
  sweep: '扫盘',
  spoof: '撤单',
  gap: '断层',
  divergence: '背离',
  whale: '巨鲸',
  depth: '深度',
} as const;
export const ALERT_STATUS = {
  published: '已发布',
  unpublished: '未发布',
  offline: '已下架',
} as const;
export type AlertStatus = keyof typeof ALERT_STATUS;
export const MODULES = {
  content: '内容管理',
  website: '网站管理',
  overview: '数据概览',
  users: '用户管理',
  system: '系统管理',
} as const;
export type Module = keyof typeof MODULES;
export type Row = Record<string, any> & { id: number };
export interface Account extends Row {
  email: string;
  name: string;
  role: 'super' | 'content';
  enabled: boolean;
}
export interface Session {
  token: string;
  account: Account;
  permissions: Module[];
}
export interface Database {
  version: number;
  alerts: Row[];
  glossary: Row[];
  tokens: Row[];
  whales: Row[];
  links: Row[];
  nodes: Row[];
  users: Row[];
  accounts: Account[];
  audit: Row[];
  daily: Row[];
  sessions: Record<string, number>;
  permissions: Module[];
  nodeConfig: {
    interval: number;
    latencyThreshold: number;
    degradedAfter: number;
    downAfter: number;
    policy: string;
  };
}
export interface PageResult {
  items: Row[];
  total: number;
}
