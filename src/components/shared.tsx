import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, App, Button, Empty, Input, Popconfirm, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Search, RefreshCw, ArrowUpRight } from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../services/api';
import type { Row } from '../types';
export function useData<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<T>(path)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, loading, error, reload };
}
export function useAction(reload?: () => void) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(
    operation: () => Promise<T>,
    success = '操作成功',
  ): Promise<T | undefined> => {
    setBusy(true);
    try {
      const result = await operation();
      if (success) message.success(success);
      reload?.();
      return result;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}
export function PageHead({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  extra,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={'panel ' + className}>
      {title && (
        <div className="panel-head">
          <div>
            <h3>{title}</h3>
            {description && <p>{description}</p>}
          </div>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}
export function Status({ value, label }: { value: string; label?: string }) {
  const labels: Record<string, string> = {
    published: '已发布',
    draft: '草稿',
    saved: '已保存',
    scheduled: '定时',
    unpublished: '未发布',
    offline: '已下架',
    active: '正常',
    disabled: '已停用',
    degraded: '异常',
    down: '中断',
    success: '通过',
    failed: '失败',
    untested: '未探测',
    super: '超级管理员',
    content: '内容管理员',
  };
  return (
    <span className={'status status-' + value}>
      <i />
      {label || labels[value] || value}
    </span>
  );
}
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
export function FilterInput({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      allowClear
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
export function SearchActions({
  onSearch,
  onReset,
}: {
  onSearch: () => void;
  onReset: () => void;
}) {
  return (
    <div className="filter-actions">
      <Button type="primary" icon={<Search size={15} />} onClick={onSearch}>
        搜索
      </Button>
      <Button onClick={onReset}>重置</Button>
    </div>
  );
}
export function ResourceTable({
  columns,
  data,
  loading,
  total,
  page,
  pageSize = 10,
  onPage,
  error,
}: {
  columns: ColumnsType<Row>;
  data: Row[];
  loading: boolean;
  total: number;
  page: number;
  pageSize?: number;
  onPage: (page: number) => void;
  error?: string;
}) {
  return (
    <>
      {error && <Alert type="error" showIcon title={error} />}
      <Table<Row>
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty description="暂无符合条件的数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: onPage,
          showSizeChanger: false,
          showTotal: (n) => (
            <span>
              共 <b>{n}</b> 条记录
            </span>
          ),
        }}
      />
    </>
  );
}
export function ConfirmAction({
  label,
  title,
  onConfirm,
  danger = false,
  disabled = false,
}: {
  label: string;
  title: string;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Popconfirm
      title={title}
      onConfirm={onConfirm}
      okText="确认"
      cancelText="取消"
      disabled={disabled}
    >
      <Button type="link" size="small" danger={danger} disabled={disabled}>
        {label}
      </Button>
    </Popconfirm>
  );
}
export function RefreshButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <Tooltip title="刷新数据">
      <Button icon={<RefreshCw size={16} />} onClick={onClick} loading={loading}>
        刷新
      </Button>
    </Tooltip>
  );
}
export const dateTime = (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '—');
export const money = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
export function NumberId({ value }: { value: number }) {
  return <span className="mono id-text">{value}</span>;
}
export function SmallLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={13} />
    </button>
  );
}
