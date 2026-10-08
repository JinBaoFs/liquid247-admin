import { useState } from 'react';
import { Button, DatePicker, Descriptions, Modal, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { PageResult, Row } from '../types';
import { queryString } from '../services/api';
import {
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
  useData,
} from '../components/shared';
export default function Audit() {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const { data, loading, error, reload } = useData<PageResult>(
    'audit?' + queryString({ ...filters, page }),
  );
  const set = (key: string, value: string) => setDraft((s) => ({ ...s, [key]: value }));
  const columns: ColumnsType<Row> = [
    { title: '时间', dataIndex: 'time', width: 155, render: dateTime },
    {
      title: '账号',
      dataIndex: 'account',
      width: 220,
      render: (v, r) => (
        <div className="link-cell">
          <b>{v}</b>
          <span>{r.email}</span>
        </div>
      ),
    },
    { title: '角色', dataIndex: 'role', width: 135, render: (v) => <Status value={v} /> },
    { title: '动作', dataIndex: 'action', width: 165 },
    { title: '对象', dataIndex: 'object_id', width: 100, render: (v) => <NumberId value={v} /> },
    { title: '备注', dataIndex: 'note', width: 220, render: (v) => v || '—' },
    {
      title: '详情',
      width: 95,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setSelected(r)}>
          查看变更
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="SYSTEM MANAGEMENT"
        title="操作日志"
        description="追溯每一次业务变更，记录操作者、数字对象 ID 与前后状态。"
        actions={<RefreshButton onClick={reload} />}
      />
      <Panel className="filter-panel">
        <div className="filters-row audit-filters">
          <FilterField label="账号邮箱">
            <FilterInput
              value={draft.email}
              onChange={(v) => set('email', v)}
              placeholder="输入邮箱"
            />
          </FilterField>
          <FilterField label="动作">
            <FilterInput
              value={draft.action}
              onChange={(v) => set('action', v)}
              placeholder="如 发布、停用"
            />
          </FilterField>
          <FilterField label="对象 ID">
            <FilterInput
              value={draft.object_id}
              onChange={(v) => set('object_id', v.replace(/\D/g, ''))}
              placeholder="输入数字 ID"
            />
          </FilterField>
          <FilterField label="操作时间">
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
      <Panel title="审计记录" description="找回密码仅记录已重置，不记录临时密码明文">
        <ResourceTable
          columns={columns}
          data={data?.items || []}
          total={data?.total || 0}
          loading={loading}
          error={error}
          page={page}
          onPage={setPage}
        />
      </Panel>
      <Modal
        title={'变更详情 · 日志 ' + selected?.id}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>关闭</Button>}
        width={880}
      >
        <Descriptions
          column={2}
          size="small"
          items={[
            { key: 'time', label: '时间', children: dateTime(selected?.time) },
            { key: 'account', label: '账号', children: selected?.email },
            { key: 'action', label: '动作', children: selected?.action },
            { key: 'object', label: '对象', children: selected?.object_id },
          ]}
        />
        <div className="audit-diff">
          <div>
            <h4>变更前</h4>
            <pre>{JSON.stringify(selected?.before, null, 2) || '无'}</pre>
          </div>
          <div>
            <h4>变更后</h4>
            <pre>{JSON.stringify(selected?.after, null, 2) || '无'}</pre>
          </div>
        </div>
      </Modal>
    </>
  );
}
