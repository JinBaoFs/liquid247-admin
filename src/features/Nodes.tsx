import { useEffect, useState } from 'react';
import { Alert, Button, Dropdown, Form, InputNumber, Modal, Radio, Space } from 'antd';
import { Activity, CheckCircle2, CircleAlert, Settings2, XCircle, ChevronDown } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { PageResult, Row } from '../types';
import { api, patch, post } from '../services/api';
import {
  NumberId,
  PageHead,
  Panel,
  RefreshButton,
  ResourceTable,
  Status,
  useAction,
  useData,
} from '../components/shared';
export default function Nodes() {
  const { data, loading, error, reload } = useData<PageResult>('nodes?pageSize=200');
  const { data: config, reload: reloadConfig } = useData<any>('nodes/config');
  const { run, busy } = useAction(reload);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => {
    if (open && config) form.setFieldsValue(config);
  }, [open, config]);
  useEffect(() => {
    if (!config) return;
    const timer = setInterval(() => {
      void post('nodes/batch-probe')
        .then(reload)
        .catch(() => {});
    }, config.interval * 1000);
    return () => clearInterval(timer);
  }, [config?.interval, reload]);
  const items = data?.items || [];
  const columns: ColumnsType<Row> = [
    {
      title: '节点',
      dataIndex: 'name',
      width: 260,
      render: (v, r) => (
        <div className="node-name">
          <span className={'node-icon ' + r.status}>
            <Activity size={17} />
          </span>
          <div>
            <b>{v}</b>
            <small className="mono">节点 ID {r.id}</small>
          </div>
        </div>
      ),
    },
    { title: '覆盖', dataIndex: 'coverage', width: 220 },
    {
      title: '延迟',
      dataIndex: 'latency',
      width: 150,
      render: (v, r) => (
        <span
          className={
            'latency-value ' +
            (r.status === 'active' ? 'positive' : r.status === 'down' ? 'negative' : 'warning-text')
          }
        >
          {r.status === 'down' ? '—' : v + ' ms'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 130,
      render: (v) => (
        <Status
          value={v}
          label={v === 'active' ? 'active' : v === 'degraded' ? 'degraded' : 'down'}
        />
      ),
    },
    // {
    //   title: '操作',
    //   width: 140,
    //   render: (_, r) => (
    //     <Dropdown
    //       menu={{
    //         items: [
    //           { key: 'success', label: '模拟探测成功' },
    //           { key: 'failed', label: '模拟心跳中断' },
    //         ],
    //         onClick: ({ key }) =>
    //           void run(() => post('nodes/' + r.id + '/probe', { scenario: key }), '探测完成'),
    //       }}
    //       trigger={['click']}
    //       disabled={busy}
    //     >
    //       <Button type="link">
    //         手动探测
    //         <ChevronDown size={12} />
    //       </Button>
    //     </Dropdown>
    //   ),
    // },
  ];
  return (
    <>
      <PageHead
        eyebrow="DATA OVERVIEW"
        title="延迟检测"
        description="观察接入节点与关键 REST 的健康状态，及时发现数据延迟。"
        actions={
          <>
            <RefreshButton
              onClick={() => void run(() => post('nodes/batch-probe'), '节点数据已刷新')}
              loading={busy}
            />
            <Button icon={<Settings2 size={16} />} onClick={() => setOpen(true)}>
              探测配置
            </Button>
          </>
        }
      />
      <div className="node-summary">
        {[
          { key: 'active', label: '正常节点', icon: CheckCircle2 },
          { key: 'degraded', label: '异常节点', icon: CircleAlert },
          { key: 'down', label: '中断节点', icon: XCircle },
        ].map((s) => (
          <div key={s.key}>
            <span className={'node-summary-icon ' + s.key}>
              <s.icon size={21} />
            </span>
            <div>
              <span>{s.label}</span>
              <b>
                {items.filter((n) => n.status === s.key).length}
                <small> / {items.length}</small>
              </b>
            </div>
          </div>
        ))}
      </div>
      <Alert
        type="info"
        showIcon
        title={
          '模拟自动探测每 ' +
          (config?.interval || 20) +
          ' 秒更新 · 延迟超过 ' +
          (config?.latencyThreshold || 200) +
          'ms 或心跳中断超过 ' +
          (config?.degradedAfter || 10) +
          's 为 degraded'
        }
        description={
          '心跳中断超过 ' +
          (config?.downAfter || 60) +
          's 为 down；异常策略：' +
          (config?.policy === 'manual' ? '标记数据延迟，允许人工发布' : '停止该场所自动发布')
        }
        style={{ marginBottom: 20 }}
      />
      <Panel title="接入节点" description="WS 心跳以最后行情时间戳为准；当前所有节点均为模拟数据">
        <ResourceTable
          columns={columns}
          data={items}
          total={items.length}
          loading={loading}
          error={error}
          page={1}
          pageSize={200}
          onPage={() => {}}
        />
      </Panel>
      <Modal
        title="探测配置"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="保存配置"
        cancelText="取消"
        confirmLoading={busy}
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const result = await run(() => patch('nodes/config', values), '探测配置已保存');
            if (result) {
              setOpen(false);
              reloadConfig();
            }
          }}
        >
          <Form.Item name="interval" label="探测间隔（秒）" rules={[{ required: true }]}>
            <InputNumber min={5} max={300} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="latencyThreshold"
            label="延迟异常阈值（ms）"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <div className="form-two">
            <Form.Item name="degradedAfter" label="心跳异常阈值（秒）" rules={[{ required: true }]}>
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="downAfter"
              label="心跳中断阈值（秒）"
              dependencies={['degradedAfter']}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator: (_, v) =>
                    v > getFieldValue('degradedAfter')
                      ? Promise.resolve()
                      : Promise.reject(new Error('中断阈值必须高于异常阈值')),
                }),
              ]}
            >
              <InputNumber min={2} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="policy" label="异常时发布策略">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="stop">停止该场所自动发布</Radio>
                <Radio value="manual">标记数据延迟，允许人工发布</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
