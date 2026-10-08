import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, Modal, Space, Switch } from 'antd';
import { Plus, Save, ShieldCheck } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import { MODULES, type Module, type PageResult, type Row } from '../types';
import { useAuth } from '../app/auth';
import { patch, post, remove } from '../services/api';
import {
  ConfirmAction,
  PageHead,
  Panel,
  ResourceTable,
  Status,
  useAction,
  useData,
} from '../components/shared';
export default function Accounts() {
  const { session, refresh } = useAuth();
  const { data, loading, error, reload } = useData<PageResult>('accounts?pageSize=200');
  const { data: permissions, reload: reloadPermissions } = useData<Module[]>('permissions');
  const [selected, setSelected] = useState<Module[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { run, busy } = useAction(reload);
  useEffect(() => {
    if (permissions) setSelected(permissions);
  }, [permissions]);
  useEffect(() => {
    if (open) form.resetFields();
  }, [open]);
  const columns: ColumnsType<Row> = [
    { title: '邮箱', dataIndex: 'email' },
    { title: '姓名', dataIndex: 'name' },
    { title: '角色', dataIndex: 'role', render: (v) => <Status value={v} /> },
    {
      title: '启用',
      dataIndex: 'enabled',
      render: (v, r) => (
        <Switch
          checked={v}
          disabled={r.id === session?.account.id || busy}
          onChange={() =>
            void run(
              () => post('accounts/' + r.id + '/toggle'),
              v ? '账号已停用，会话立即失效' : '账号已启用',
            )
          }
        />
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) =>
        r.role === 'super' ? (
          <span className="muted small">当前超管</span>
        ) : (
          <ConfirmAction
            label="删除"
            danger
            title="确认删除内容管理员？其会话将立即失效。"
            onConfirm={() => void run(() => remove('accounts/' + r.id), '后台账号已删除')}
          />
        ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="SYSTEM MANAGEMENT"
        title="后台账号"
        description="管理内容管理员与板块授权，此页面仅超级管理员可访问。"
        actions={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            新增内容管理员
          </Button>
        }
      />
      <Panel title="账号列表">
        <ResourceTable
          columns={columns}
          data={data?.items || []}
          total={data?.total || 0}
          loading={loading}
          error={error}
          page={1}
          pageSize={200}
          onPage={() => {}}
        />
      </Panel>
      <Panel
        title="内容管理员可用板块"
        description="授权对所有内容管理员生效，侧栏和页面访问同步受控"
        className="permission-panel"
      >
        <Alert
          type="info"
          showIcon
          title="系统管理授权仅开放操作日志；后台账号始终仅超级管理员可用。"
        />
        <div className="permission-options">
          {(Object.entries(MODULES) as [Module, string][]).map(([key, label]) => (
            <label
              className={'permission-option ' + (selected.includes(key) ? 'checked' : '')}
              key={key}
            >
              <Checkbox
                checked={selected.includes(key)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, key] : s.filter((v) => v !== key)))
                }
              />
              <div>
                <b>{label}</b>
                <span>
                  {key === 'content'
                    ? '情报工作台、术语库'
                    : key === 'website'
                      ? '监测池、巨鲸名单、链接数据'
                      : key === 'overview'
                        ? '值班总览、延迟检测'
                        : key === 'users'
                          ? '前台用户管理'
                          : '操作日志'}
                </span>
              </div>
            </label>
          ))}
        </div>
        <Button
          type="primary"
          icon={<Save size={16} />}
          loading={busy}
          onClick={() =>
            void run(async () => {
              await patch('permissions', { permissions: selected });
              reloadPermissions();
              await refresh();
            }, '板块授权已保存')
          }
        >
          保存板块授权
        </Button>
      </Panel>
      <Modal
        title="新增内容管理员"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="创建账号"
        cancelText="取消"
        confirmLoading={busy}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const result = await run(() => post('accounts', values), '内容管理员已创建');
            if (result) setOpen(false);
          }}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱' },
            ]}
          >
            <Input placeholder="name@company.com" />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, whitespace: true, message: '请输入姓名' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="角色">
            <Input value="内容管理员" disabled />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            title="本地演示账号统一使用密码 Demo247!"
            description="真实账号创建与初始密码交付将在接入后端后实现。"
          />
        </Form>
      </Modal>
    </>
  );
}
