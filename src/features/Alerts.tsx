import { useState } from 'react';
import { Button, DatePicker, Input, Select, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ALERT_STATUS, ALERT_TYPES, type PageResult, type Row } from '../types';
import { useAuth } from '../app/auth';
import { post, queryString, remove } from '../services/api';
import {
  ConfirmAction,
  dateTime,
  FilterField,
  FilterInput,
  NumberId,
  PageHead,
  Panel,
  RefreshButton,
  ResourceTable,
  SearchActions,
  Status,
  useAction,
  useData,
} from '../components/shared';
const options = (values: Record<string, string>) =>
  Object.entries(values).map(([value, label]) => ({ value, label }));
export default function Alerts() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useData<PageResult>(
    'alerts?' + queryString({ ...filters, page }),
  );
  const { data: tokens } = useData<PageResult>('tokens?pageSize=200');
  const { run, busy } = useAction(reload);
  const set = (key: string, value: string) => setDraft((v) => ({ ...v, [key]: value }));
  const columns: ColumnsType<Row> = [
    { title: 'ID', dataIndex: 'id', width: 100, render: (v) => <NumberId value={v} /> },
    { title: '状态', dataIndex: 'status', width: 100, render: (v) => <Status value={v} /> },
    { title: '点击量', dataIndex: 'clicks', width: 75, render: (v) => v.toLocaleString() },
    { title: '收藏量', dataIndex: 'favorites', width: 85 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v) => (
        <span className="type-label">{ALERT_TYPES[v as keyof typeof ALERT_TYPES]}</span>
      ),
    },
    {
      title: 'Token',
      dataIndex: 'token',
      width: 75,
      render: (v) => <Tag className="token-tag">{v}</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'headline',
      width: 280,
      render: (v, row) => (
        <button className="headline-link" onClick={() => navigate('/admin/alerts/' + row.id)}>
          {v}
        </button>
      ),
    },
    { title: '发布时间', dataIndex: 'time', width: 150, render: dateTime },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => navigate('/admin/alerts/' + row.id)}>
            编辑
          </Button>
          {row.status === 'published' ? (
            <ConfirmAction
              label="下架"
              title="确认下架这条情报？"
              onConfirm={() =>
                void run(() => post('alerts/' + row.id + '/unpublish'), '情报已下架')
              }
              disabled={busy}
            />
          ) : (
            <ConfirmAction
              label={row.status === 'offline' ? '再次发布' : '发布'}
              title="确认立即发布这条情报？"
              onConfirm={() => void run(() => post('alerts/' + row.id + '/publish'), '情报已发布')}
              disabled={busy}
            />
          )}{' '}
          {session?.account.role === 'super' && (
            <ConfirmAction
              label={row.everPublished ? '归档' : '删除'}
              danger
              title={
                row.everPublished ? '情报将下架并归档，保留历史数据。' : '确认删除这条未发布情报？'
              }
              onConfirm={() =>
                void run(
                  () => remove('alerts/' + row.id),
                  row.everPublished ? '已下架并归档' : '已删除',
                )
              }
              disabled={busy}
            />
          )}
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="CONTENT MANAGEMENT"
        title="情报工作台"
        description="管理每一条市场情报，从未发布到正式发布，让内容有序流转。"
        actions={
          <>
            <RefreshButton onClick={reload} />
            <Button
              type="primary"
              icon={<Plus size={17} />}
              onClick={() => navigate('/admin/alerts/new')}
            >
              新建情报
            </Button>
          </>
        }
      />
      <Panel className="filter-panel">
        <div className="filters-grid alert-filters">
          <FilterField label="情报 ID">
            <FilterInput
              value={draft.id}
              onChange={(v) => set('id', v.replace(/\D/g, ''))}
              placeholder="输入数字 ID"
            />
          </FilterField>
          <FilterField label="标题">
            <FilterInput
              value={draft.headline}
              onChange={(v) => set('headline', v)}
              placeholder="搜索标题内容"
            />
          </FilterField>
          <FilterField label="分类">
            <Select
              allowClear
              placeholder="全部分类"
              value={draft.type || undefined}
              options={options(ALERT_TYPES)}
              onChange={(v) => set('type', v || '')}
            />
          </FilterField>
          <FilterField label="Token">
            <Select
              allowClear
              showSearch
              placeholder="全部品种"
              value={draft.token || undefined}
              options={tokens?.items.map((t) => ({ label: t.symbol, value: t.symbol })) || []}
              onChange={(v) => set('token', v || '')}
            />
          </FilterField>
          <FilterField label="发布状态">
            <Select
              allowClear
              placeholder="全部状态"
              value={draft.status || undefined}
              options={options(ALERT_STATUS)}
              onChange={(v) => set('status', v || '')}
            />
          </FilterField>
          <FilterField label="发布时间">
            <DatePicker.RangePicker
              value={draft.start && draft.end ? [dayjs(draft.start), dayjs(draft.end)] : null}
              onChange={(v) =>
                setDraft((s) => ({
                  ...s,
                  start: v?.[0]?.format('YYYY-MM-DD') || '',
                  end: v?.[1]?.format('YYYY-MM-DD') || '',
                }))
              }
            />
          </FilterField>
          <SearchActions
            onSearch={() => {
              setFilters({ ...draft });
              setPage(1);
            }}
            onReset={() => {
              setDraft({});
              setFilters({});
              setPage(1);
            }}
          />
        </div>
      </Panel>
      <Panel
        title="情报列表"
        description="点击标题进入编辑，统计数据只读"
        extra={
          <span className="list-count">
            <FileText size={15} />
            {data?.total || 0} 条情报
          </span>
        }
      >
        <ResourceTable
          columns={columns}
          data={data?.items || []}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPage={setPage}
          error={error}
        />
      </Panel>
    </>
  );
}
import dayjs from 'dayjs';
