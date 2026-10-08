import { useState } from 'react';
import { App, Button, Descriptions, Drawer, Input, Modal, Space, Tag } from 'antd';
import { Copy, LockKeyhole, Users as UsersIcon } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { PageResult, Row } from '../types';
import { post, queryString } from '../services/api';
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
function UserDetail({ row, onClose }: { row: Row; onClose: () => void }) {
  const { data } = useData<Row>('users/' + row.id);
  const u = data || row;
  return (
    <Drawer open title={'前台用户 · ' + row.id} onClose={onClose} size="large">
      <div className="user-detail-head">
        <span className="large-avatar">{u.nickname.slice(0, 1)}</span>
        <div>
          <h3>{u.nickname}</h3>
          <p>{u.email}</p>
        </div>
        <Status value={u.status} />
      </div>
      <Descriptions
        column={1}
        bordered
        size="small"
        items={[
          { key: 'id', label: '用户 ID', children: <NumberId value={u.id} /> },
          { key: 'registered', label: '注册时间', children: dateTime(u.registered_at) },
          { key: 'last', label: '最后登录', children: dateTime(u.last_login_at) },
          { key: 'language', label: '语言', children: u.settings.language },
          {
            key: 'theme',
            label: '看板偏好',
            children: u.settings.theme === 'light' ? '浅色' : '深色',
          },
          {
            key: 'notify',
            label: '通知偏好',
            children: u.settings.notifications ? '开启' : '关闭',
          },
        ]}
      />
      <h4 className="detail-section-title">监测列表</h4>
      <Space wrap>
        {u.watchlist.map((token: string) => (
          <Tag key={token}>{token}</Tag>
        ))}
      </Space>
      <h4 className="detail-section-title">品种阈值</h4>
      {Object.entries(u.tokenThresholds).map(([token, value]) => (
        <div className="detail-row" key={token}>
          <span>{token}</span>
          <b>USD {Number(value).toLocaleString()}</b>
        </div>
      ))}
      <h4 className="detail-section-title">收藏情报 · {u.saved.length}</h4>
      {(u.savedAlerts || []).map((a: Row) => (
        <div className="saved-alert" key={a.id}>
          <span className="mono muted">{a.id}</span>
          <p>{a.headline}</p>
        </div>
      ))}
      <p className="muted small">用户资料与私有偏好仅供查看。</p>
    </Drawer>
  );
}
export default function Users() {
  const { modal } = App.useApp();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Row | null>(null);
  const [password, setPassword] = useState<{ id: number; value: string } | null>(null);
  const { data, loading, error, reload } = useData<PageResult>(
    'users?' + queryString({ ...filters, page }),
  );
  const { run, busy } = useAction(reload);
  const set = (key: string, value: string) => setDraft((s) => ({ ...s, [key]: value }));
  const reset = (row: Row) =>
    modal.confirm({
      title: '为用户 ' + row.id + ' 找回密码？',
      content: '将生成一次性演示临时密码，仅展示一次。操作日志只记录已重置。',
      okText: '生成临时密码',
      cancelText: '取消',
      onOk: async () => {
        const result = await run(
          () => post('users/' + row.id + '/reset-password'),
          '临时密码已生成',
        );
        if (result) setPassword({ id: row.id, value: result.temporaryPassword });
      },
    });
  const columns: ColumnsType<Row> = [
    { title: '用户 ID', dataIndex: 'id', width: 105, render: (v) => <NumberId value={v} /> },
    { title: '邮箱', dataIndex: 'email', width: 230 },
    {
      title: '昵称',
      dataIndex: 'nickname',
      width: 180,
      render: (v, r) => (
        <button className="headline-link" onClick={() => setSelected(r)}>
          {v}
        </button>
      ),
    },
    { title: '监测', dataIndex: 'watchlist', width: 80, render: (v) => v.length },
    { title: '收藏', dataIndex: 'saved', width: 80, render: (v) => v.length },
    { title: '最后登录', dataIndex: 'last_login_at', width: 155, render: dateTime },
    { title: '状态', dataIndex: 'status', width: 105, render: (v) => <Status value={v} /> },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => setSelected(r)}>
            查看
          </Button>
          <ConfirmAction
            label={r.status === 'active' ? '停用' : '恢复'}
            title={r.status === 'active' ? '确认停用该前台用户？' : '确认恢复该前台用户？'}
            danger={r.status === 'active'}
            onConfirm={() => void run(() => post('users/' + r.id + '/toggle'), '用户状态已更新')}
          />
          <Button type="link" size="small" disabled={busy} onClick={() => reset(r)}>
            找回密码
          </Button>
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="USER MANAGEMENT"
        title="前台用户"
        description="查看用户监测与收藏偏好，维护账号状态与访问能力。"
      />
      <Panel className="filter-panel">
        <div className="filters-row">
          <FilterField label="邮箱">
            <FilterInput
              value={draft.email}
              onChange={(v) => set('email', v)}
              placeholder="输入邮箱"
            />
          </FilterField>
          <FilterField label="用户 ID">
            <FilterInput
              value={draft.id}
              onChange={(v) => set('id', v.replace(/\D/g, ''))}
              placeholder="输入数字 ID"
            />
          </FilterField>
          <FilterField label="昵称">
            <FilterInput
              value={draft.nickname}
              onChange={(v) => set('nickname', v)}
              placeholder="输入昵称"
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
        title="用户列表"
        extra={
          <span className="list-count">
            <UsersIcon size={15} />
            {data?.total || 0} 个账号
          </span>
        }
      >
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
      {selected && <UserDetail row={selected} onClose={() => setSelected(null)} />}
      <Modal
        title={'用户 ' + password?.id + ' 的临时密码'}
        open={!!password}
        onCancel={() => setPassword(null)}
        afterClose={() => setPassword(null)}
        footer={
          <Button type="primary" onClick={() => setPassword(null)}>
            我已保存，关闭
          </Button>
        }
      >
        <div className="password-note">
          <LockKeyhole size={28} />
          <p>此演示密码仅展示一次，关闭后无法再次查看。</p>
        </div>
        <Input
          readOnly
          value={password?.value || ''}
          size="large"
          suffix={
            <Button
              type="text"
              aria-label="复制临时密码"
              icon={<Copy size={16} />}
              onClick={() =>
                void run(
                  () => navigator.clipboard.writeText(password?.value || ''),
                  '已复制临时密码',
                )
              }
            />
          }
        />
        <p className="muted small">Mock 环境生成的密码不连接真实账号服务。</p>
      </Modal>
    </>
  );
}
