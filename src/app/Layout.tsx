import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Dropdown, Modal, Skeleton } from 'antd';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Database,
  FileText,
  Gauge,
  LayoutDashboard,
  Link2,
  LogOut,
  Radar,
  ShieldCheck,
  Users,
  Waves,
  RotateCcw,
  CircleHelp,
} from 'lucide-react';
import { useAuth } from './auth';
import { post } from '../services/api';
import { useAction } from '../components/shared';
import { MODULES, type Module } from '../types';
const groups: { key: Module; items: { path: string; label: string; icon: typeof Activity }[] }[] = [
  {
    key: 'content',
    items: [
      { path: 'alerts', label: '情报工作台', icon: FileText },
      { path: 'glossary', label: '术语库', icon: BookOpen },
    ],
  },
  {
    key: 'website',
    items: [
      { path: 'tokens', label: '监测池', icon: Radar },
      { path: 'whales', label: '巨鲸名单', icon: Waves },
      { path: 'links', label: '链接数据', icon: Link2 },
    ],
  },
  {
    key: 'overview',
    items: [
      { path: 'overview', label: '值班总览', icon: LayoutDashboard },
      { path: 'nodes', label: '延迟检测', icon: Activity },
    ],
  },
  { key: 'users', items: [{ path: 'users', label: '前台用户', icon: Users }] },
  {
    key: 'system',
    items: [
      { path: 'accounts', label: '后台账号', icon: ShieldCheck },
      { path: 'audit', label: '操作日志', icon: Database },
    ],
  },
];
export function HomeRedirect() {
  const { session } = useAuth();
  const module = session?.permissions.includes('overview') ? 'overview' : session?.permissions[0];
  const path = groups
    .find((g) => g.key === module)
    ?.items.find((i) => i.path !== 'accounts' || session?.account.role === 'super')?.path;
  return path ? (
    <Navigate to={'/admin/' + path} replace />
  ) : (
    <div className="no-access">
      <ShieldCheck size={40} />
      <h2>暂无已授权板块</h2>
      <p>请联系超级管理员调整板块授权。</p>
    </div>
  );
}
export function Guard({
  module,
  superOnly = false,
  children,
}: {
  module: Module;
  superOnly?: boolean;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  return session?.permissions.includes(module) &&
    (!superOnly || session.account.role === 'super') ? (
    <>{children}</>
  ) : (
    <div className="no-access">
      <ShieldCheck size={40} />
      <h2>没有访问权限</h2>
      <p>当前账号未获授权访问此页面。</p>
      <NavLink to="/admin">返回工作台</NavLink>
    </div>
  );
}
export default function Layout() {
  const { modal } = App.useApp();
  const { session, ready, logout } = useAuth();
  const { run } = useAction();
  const location = useLocation();
  const navigate = useNavigate();
  const active = groups
    .flatMap((g) => g.items)
    .find((i) => location.pathname.startsWith('/admin/' + i.path));
  useEffect(() => {
    document.title = (active?.label || '运营后台') + ' · LIQUID247';
  }, [active?.label]);
  if (!ready)
    return (
      <div className="boot">
        <Skeleton active />
      </div>
    );
  if (!session) return <Navigate to="/admin/login" replace />;
  const reset = () =>
    modal.confirm({
      title: '重置演示数据？',
      content: '所有本地修改将恢复为初始演示数据。',
      okText: '重置',
      cancelText: '取消',
      onOk: async () => {
        const result = await run(() => post('demo/reset'), '演示数据已重置');
        if (result) window.location.reload();
      },
    });
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <NavLink to="/admin" className="brand">
          <span className="brand-mark">
            <Waves size={24} />
          </span>
          <div>
            LIQUID<span>247</span>
            <small>OPERATIONS CONSOLE</small>
          </div>
        </NavLink>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Gauge size={16} />
          </span>
          <span>
            网站运营工作台<small>Liquid247.xyz</small>
          </span>
          <span className="workspace-dot" />
        </div>
        <nav>
          {groups
            .filter((g) => session.permissions.includes(g.key))
            .map((g) => (
              <div className="nav-group" key={g.key}>
                <div className="nav-label">{MODULES[g.key]}</div>
                {g.items
                  .filter((i) => i.path !== 'accounts' || session.account.role === 'super')
                  .map((i) => (
                    <NavLink
                      to={'/admin/' + i.path}
                      aria-label={i.label}
                      className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                      key={i.path}
                    >
                      <i.icon size={18} />
                      <span>{i.label}</span>
                      {i.path === 'alerts' && <span className="nav-mini">内容</span>}
                    </NavLink>
                  ))}
              </div>
            ))}
        </nav>
        {/* <div className="sidebar-bottom">
          <div className="demo-note">
            <div>
              <span className="demo-dot" />
              本地演示环境
            </div>
            <p>数据与接口均为静态模拟</p>
            <button onClick={reset}>
              <RotateCcw size={13} />
              重置演示数据
            </button>
          </div>
          <div className="sidebar-version">
            LIQUID247 ADMIN <span>v0.1</span>
          </div>
        </div> */}
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>运营后台</span>
            <span>/</span>
            <b>{active?.label || '工作台'}</b>
          </div>
          <div className="topbar-right">
            {/* <span className="environment-tag">
              <i />
              MOCK 环境
            </span> */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'role',
                    label: session.account.role === 'super' ? '超级管理员' : '内容管理员',
                    disabled: true,
                  },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogOut size={15} />, label: '退出登录', onClick: logout },
                ],
              }}
              trigger={['click']}
            >
              <button className="account-trigger">
                <Avatar size={32} style={{ background: '#eee8ff', color: '#7551e8' }}>
                  {session.account.name.slice(0, 1)}
                </Avatar>
                <span>{session.account.name}</span>
                <ChevronDown size={14} />
              </button>
            </Dropdown>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="main-footer">
          <span>© {new Date().getFullYear()} LIQUID247 · 网站运营后台</span>
          <span>
            <CircleHelp size={13} />
            所有市场数据均为模拟数据
          </span>
        </footer>
      </div>
    </div>
  );
}
