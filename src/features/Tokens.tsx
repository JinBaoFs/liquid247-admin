import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Select, Space, Tag } from 'antd';
import { Plus, Radio } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { PageResult, Row } from '../types';
import { post, queryString } from '../services/api';
import {
  ConfirmAction,
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
export default function Tokens() {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [probe, setProbe] = useState<any>(null);
  const { data, loading, error, reload } = useData<PageResult>(
    'tokens?' + queryString({ query: search, page }),
  );
  const { run, busy } = useAction(reload);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ world: 'crypto', scenario: 'success' });
      setProbe(null);
    }
  }, [open]);
  const columns: ColumnsType<Row> = [
    { title: '内部 ID', dataIndex: 'id', width: 100, render: (v) => <NumberId value={v} /> },
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      render: (v) => (
        <span className="asset-symbol">
          <span className="asset-avatar">{v[0]}</span>
          <b>{v}</b>
        </span>
      ),
    },
    { title: '名称', dataIndex: 'name' },
    { title: '交易对', dataIndex: 'pair', render: (v) => <span className="mono">{v}</span> },
    {
      title: '市场',
      dataIndex: 'world',
      render: (v) => <Tag>{v === 'crypto' ? '加密资产' : '传统资产'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => <Status value={v} label={v === 'active' ? '在池' : '已停用'} />,
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <ConfirmAction
          label={r.status === 'active' ? '停用' : '启用'}
          title={
            r.status === 'active' ? '停用后不再生成该品种的新情报，是否继续？' : '确认启用品种？'
          }
          danger={r.status === 'active'}
          onConfirm={() => void run(() => post('tokens/' + r.id + '/toggle'), '监测池已更新')}
        />
      ),
    },
  ];
  const test = async () => {
    try {
      await form.validateFields(['symbol', 'pair']);
    } catch {
      return;
    }
    setProbe(null);
    const result = await run(() => post('tokens/probe', form.getFieldsValue()), '');
    if (result) setProbe(result);
  };
  return (
    <>
      <PageHead
        eyebrow="WEBSITE MANAGEMENT"
        title="监测池"
        description="统一维护监测品种，只有数据链接探测通过后才能加入。"
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            增加品种
          </Button>
        }
      />
      <Panel className="filter-panel">
        <div className="filters-row">
          <FilterField label="Symbol / 名称 / 交易对">
            <FilterInput value={draft} onChange={setDraft} placeholder="如 BTC、比特币、BTCUSDT" />
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
      <Panel title="监测品种" description="前台用户只能关注监测池内的品种">
        <ResourceTable
          columns={columns}
          data={data?.items || []}
          loading={loading}
          error={error}
          total={data?.total || 0}
          page={page}
          onPage={setPage}
        />
      </Panel>
      <Modal
        title="增加监测品种"
        open={open}
        onCancel={() => setOpen(false)}
        okText="确认加入"
        cancelText="取消"
        confirmLoading={busy}
        okButtonProps={{ disabled: !probe?.passed }}
        onOk={() => form.submit()}
        width={600}
      >
        <Alert
          type="info"
          showIcon
          title="演示探测不会请求真实行情源"
          description="可选择成功、失败或超时场景，验证加入前的探测流程。"
          style={{ marginBottom: 20 }}
        />
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setProbe(null)}
          onFinish={async (values) => {
            if (!probe?.passed) return;
            const result = await run(
              () => post('tokens', { ...values, proof: probe.proof }),
              '品种已加入监测池',
            );
            if (result) setOpen(false);
          }}
        >
          <div className="form-two">
            <Form.Item
              name="symbol"
              label="Symbol"
              normalize={(v) => v?.toUpperCase()}
              rules={[
                { required: true, whitespace: true, message: '请输入 Symbol' },
                { pattern: /^[A-Z0-9.]{1,16}$/, message: '请输入大写字母、数字或小数点' },
              ]}
            >
              <Input placeholder="如 ARB" />
            </Form.Item>
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, whitespace: true, message: '请输入名称' }]}
            >
              <Input placeholder="如 Arbitrum" />
            </Form.Item>
          </div>
          <Form.Item
            name="pair"
            label="交易对"
            normalize={(v) => v?.toUpperCase()}
            rules={[{ required: true, whitespace: true, message: '请输入交易对' }]}
          >
            <Input placeholder="如 ARBUSDT" />
          </Form.Item>
          <div className="form-two">
            <Form.Item name="world" label="市场">
              <Select
                options={[
                  { value: 'crypto', label: '加密资产' },
                  { value: 'trad', label: '传统资产' },
                ]}
              />
            </Form.Item>
            <Form.Item name="scenario" label="模拟探测结果">
              <Select
                options={[
                  { value: 'success', label: '成功 · 返回有效现价' },
                  { value: 'failed', label: '失败 · 无有效现价' },
                  { value: 'timeout', label: '超时' },
                ]}
              />
            </Form.Item>
          </div>
          <Button icon={<Radio size={16} />} loading={busy} onClick={() => void test()} block>
            测试数据链接
          </Button>
          {probe && (
            <Alert
              style={{ marginTop: 16 }}
              showIcon
              type={probe.passed ? 'success' : 'error'}
              title={probe.passed ? '探测通过 · 模拟现价 $' + probe.price : probe.message}
              description={probe.passed ? '修改品种信息后需要重新探测。' : undefined}
            />
          )}
        </Form>
      </Modal>
    </>
  );
}
