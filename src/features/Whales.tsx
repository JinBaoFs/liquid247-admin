import { useEffect, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Tooltip } from 'antd';
import { Copy, Plus } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import type { PageResult, Row } from '../types';
import { patch, post, queryString, remove } from '../services/api';
import {
  ConfirmAction,
  FilterField,
  money,
  NumberId,
  PageHead,
  Panel,
  ResourceTable,
  SearchActions,
  useAction,
  useData,
} from '../components/shared';
const venues = [
  'Binance 现货',
  'Binance 永续',
  'Coinbase',
  'OKX 现货',
  'Bybit',
  'Upbit',
  'Kraken',
  'Hyperliquid',
  'CME',
];
const venueId = (venue: string) => venues.indexOf(venue) + 1;
export default function Whales() {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<{ winMin?: number | null; winMax?: number | null }>({});
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const { data, loading, error, reload } = useData<PageResult>(
    'whales?' + queryString({ ...filters, page }),
  );
  const { run, busy } = useAction(reload);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(editing || { venue: 'Hyperliquid', pnl_30d: 0 });
    }
  }, [open, editing]);
  const columns: ColumnsType<Row> = [
    { title: 'ID', dataIndex: 'id', width: 90, render: (v) => <NumberId value={v} /> },
    {
      title: '地址',
      dataIndex: 'address',
      width: 270,
      render: (v, r) => (
        <div className="whale-address">
          <div>
            <Tooltip title={v}>
              <span className="mono">{v.length > 28 ? v.slice(0, 12) + '…' + v.slice(-8) : v}</span>
            </Tooltip>
            {r.label && <small>{r.label}</small>}
          </div>
          <Tooltip title="复制原始地址">
            <Button
              size="small"
              type="text"
              aria-label="复制原始地址"
              icon={<Copy size={14} />}
              onClick={() => void run(() => navigator.clipboard.writeText(v), '已复制原始地址')}
            />
          </Tooltip>
        </div>
      ),
    },
    { title: '场所', dataIndex: 'venue', width: 130 },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      width: 95,
      render: (v) =>
        v === null || v === undefined ? <span className="muted">未标注</span> : v.toFixed(1) + '%',
    },
    {
      title: '30 日盈亏',
      dataIndex: 'pnl_30d',
      width: 140,
      render: (v) => (
        <span className={v >= 0 ? 'positive' : 'negative'}>
          {v >= 0 ? '+' : ''}
          {money(v)}
        </span>
      ),
    },
    {
      title: '最近动作',
      key: 'recent',
      width: 310,
      render: (_, r) =>
        r.recent ? (
          <button
            className="headline-link"
            onClick={() => navigate('/admin/alerts/' + r.recent.id)}
          >
            {r.recent.headline}
          </button>
        ) : (
          <span className="muted">暂无对应快讯</span>
        ),
    },
    {
      title: '操作',
      width: 110,
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            onClick={() => {
              setEditing(r);
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <ConfirmAction
            label="删除"
            title="确认移除该巨鲸地址？"
            danger
            onConfirm={() => void run(() => remove('whales/' + r.id), '已移除巨鲸地址')}
          />
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="WEBSITE MANAGEMENT"
        title="巨鲸名单"
        description="维护重点地址与表现数据，最近动作关联对应情报标题。"
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            增加地址
          </Button>
        }
      />
      <Panel className="filter-panel">
        <div className="filters-row">
          <FilterField label="胜率 ≥">
            <InputNumber
              min={0}
              max={100}
              value={draft.winMin}
              onChange={(v) => setDraft((s) => ({ ...s, winMin: v }))}
              addonAfter="%"
              placeholder="最低胜率"
            />
          </FilterField>
          <FilterField label="胜率 ≤">
            <InputNumber
              min={0}
              max={100}
              value={draft.winMax}
              onChange={(v) => setDraft((s) => ({ ...s, winMax: v }))}
              addonAfter="%"
              placeholder="最高胜率"
            />
          </FilterField>
          <SearchActions
            onSearch={() => {
              if (draft.winMin != null && draft.winMax != null && draft.winMin > draft.winMax) {
                modal.warning({ title: '最低胜率不能高于最高胜率', okText: '知道了' });
                return;
              }
              setFilters({ ...draft });
              setPage(1);
            }}
            onReset={() => {
              setDraft({});
              setFilters({});
              setPage(1);
            }}
          />
          <span className="filter-note">设置胜率筛选后，未标注地址不参与结果</span>
        </div>
      </Panel>
      <Panel title="地址名单">
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
        title={editing ? '编辑巨鲸 · ' + editing.id : '增加巨鲸地址'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={busy}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const result = await run(
              () =>
                editing
                  ? patch('whales/' + editing.id, {
                      ...values,
                      win_rate: values.win_rate ?? null,
                      venue_id: venueId(values.venue),
                    })
                  : post('whales', {
                      ...values,
                      win_rate: values.win_rate ?? null,
                      venue_id: venueId(values.venue),
                    }),
              '巨鲸名单已更新',
            );
            if (result) setOpen(false);
          }}
        >
          <Form.Item
            name="address"
            label="原始地址 / 场所内部标识"
            rules={[{ required: true, whitespace: true, message: '请输入原始地址' }]}
          >
            <Input placeholder="0x… 或场所内部标识" />
          </Form.Item>
          <Form.Item name="label" label="展示标签（可选）">
            <Input placeholder="标签不用于复制" />
          </Form.Item>
          <Form.Item name="venue" label="场所" rules={[{ required: true }]}>
            <Select options={venues.map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <div className="form-two">
            <Form.Item name="win_rate" label="胜率（留空为未标注）">
              <InputNumber
                min={0}
                max={100}
                precision={1}
                addonAfter="%"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="pnl_30d"
              label="30 日盈亏（USD）"
              rules={[{ required: true, message: '请输入盈亏' }]}
            >
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}
