import { useEffect, useState } from 'react';
import { Button, Dropdown, Form, Input, Modal, Select, Space, Tooltip } from 'antd';
import { ChevronDown, Plus, Radio, LockKeyhole } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { PageResult, Row } from '../types';
import { patch, post, queryString } from '../services/api';
import {
  ConfirmAction,
  dateTime,
  FilterField,
  FilterInput,
  NumberId,
  PageHead,
  Panel,
  ResourceTable,
  SearchActions,
  Status,
  useAction,
  useData,
} from '../components/shared';
export default function Links() {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const { data, loading, error, reload } = useData<PageResult>(
    'links?' + queryString({ name: search, page }),
  );
  const { run, busy } = useAction(reload);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(editing || { kind: 'REST', venue: '站内' });
    }
  }, [open, editing]);
  const columns: ColumnsType<Row> = [
    { title: 'ID', dataIndex: 'id', width: 60, render: (v) => <NumberId value={v} /> },
    {
      title: '名称 / 地址',
      dataIndex: 'name',
      width: 330,
      render: (v, r) => (
        <div className="link-cell">
          <b>{v}</b>
          <span className="mono">{r.url}</span>
          {r.secretRef && (
            <small>
              <LockKeyhole size={12} />
              密钥管理器引用已配置
            </small>
          )}
        </div>
      ),
    },
    { title: '类型', dataIndex: 'kind', width: 95 },
    { title: '场所', dataIndex: 'venue', width: 130 },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 110,
      render: (v) => <Status value={v ? 'active' : 'disabled'} label={v ? '已启用' : '已禁用'} />,
    },
    {
      title: '探测结果',
      dataIndex: 'probeStatus',
      width: 100,
      render: (v) => <Status value={v} />,
    },
    { title: '延迟', dataIndex: 'latency', width: 85, render: (v) => (v ? v + ' ms' : '—') },
    { title: '最近探测', dataIndex: 'lastChecked', width: 150, render: dateTime },
    {
      title: '操作',
      fixed: 'right',
      width: 200,
      render: (_, r) => (
        <Space size={0}>
          {/* <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(r);
              setOpen(true);
            }}
          >
            编辑
          </Button> */}
          <Dropdown
            menu={{
              items: [
                { key: 'success', label: '模拟探测成功' },
                { key: 'failed', label: '模拟探测失败' },
              ],
              onClick: ({ key }) =>
                void run(() => post('links/' + r.id + '/probe', { scenario: key }), '探测完成'),
            }}
            trigger={['click']}
            disabled={busy}
          >
            <Button type="link" size="small">
              探测
              <ChevronDown size={12} />
            </Button>
          </Dropdown>
          <ConfirmAction
            label={r.enabled ? '禁用' : '启用'}
            title={r.enabled ? '禁用后停止该场所的新生产，确认继续？' : '确认启用此数据链接？'}
            danger={r.enabled}
            onConfirm={() => void run(() => post('links/' + r.id + '/toggle'), '链接状态已更新')}
          />
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="WEBSITE MANAGEMENT"
        title="链接数据"
        description="维护行情源、站内路由和资源链接，探测连接状态。"
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            增加链接
          </Button>
        }
      />
      <Panel className="filter-panel">
        <div className="filters-row">
          <FilterField label="链接名称">
            <FilterInput value={draft} onChange={setDraft} placeholder="搜索数据链接" />
          </FilterField>
          <SearchActions
            onSearch={() => {
              setSearch(draft);
              setPage(1);
            }}
            onReset={() => {
              setDraft('');
              setSearch('');
              setPage(1);
            }}
          />
        </div>
      </Panel>
      <Panel title="数据链接" description="探测结果为静态模拟；密钥仅维护引用地址">
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
        title={editing ? '编辑链接 · ' + editing.id : '增加数据链接'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={busy}
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const result = await run(
              () => (editing ? patch('links/' + editing.id, values) : post('links', values)),
              '数据链接已保存',
            );
            if (result) setOpen(false);
          }}
        >
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, whitespace: true, message: '请输入名称' }]}
          >
            <Input />
          </Form.Item>
          <div className="form-two">
            <Form.Item name="kind" label="类型" rules={[{ required: true }]}>
              <Select
                options={['行情 WS', 'REST', '对照', '站内路由', '字体', '脚本'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="venue"
              label="场所"
              rules={[{ required: true, whitespace: true, message: '请输入场所' }]}
            >
              <Input placeholder="如 Binance 现货" />
            </Form.Item>
          </div>
          <Form.Item
            name="url"
            label="URL / 路由"
            rules={[
              { required: true, whitespace: true, message: '请输入地址' },
              {
                validator: (_, v) =>
                  !v || /^(https?:\/\/|wss?:\/\/|\/)/.test(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error('请输入 HTTP、WS 地址或站内绝对路径')),
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="secretRef"
            label="密钥管理器引用（可选）"
            extra="只填写引用，不填写完整 API Key。"
            rules={[
              {
                validator: (_, v) =>
                  !v || /^secret:\/\//.test(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error('请使用 secret:// 引用地址')),
              },
            ]}
          >
            <Input placeholder="secret://liquid247/provider" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
