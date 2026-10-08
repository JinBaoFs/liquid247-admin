import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, Space } from 'antd';
import { Plus } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { PageResult, Row } from '../types';
import { patch, post, queryString, remove } from '../services/api';
import {
  ConfirmAction,
  FilterField,
  FilterInput,
  PageHead,
  Panel,
  ResourceTable,
  SearchActions,
  Status,
  useAction,
  useData,
} from '../components/shared';
const categories = ['订单流', '盘口结构', '跨市场', '杠杆与风险', '倾向标签'];
export default function Glossary() {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form] = Form.useForm();
  const { data, loading, error, reload } = useData<PageResult>(
    'glossary?' + queryString({ query: search, page }),
  );
  const { run, busy } = useAction(reload);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(editing || { cat: '订单流', status: 'published' });
    }
  }, [open, editing]);
  const columns: ColumnsType<Row> = [
    {
      title: '术语',
      dataIndex: 'term',
      render: (v, r) => (
        <button
          className="headline-link"
          onClick={() => {
            setEditing(r);
            setOpen(true);
          }}
        >
          {v}
        </button>
      ),
    },
    { title: '中文', dataIndex: 'name' },
    { title: '分类', dataIndex: 'cat' },
    { title: '状态', dataIndex: 'status', render: (v) => <Status value={v} /> },
    {
      title: '操作',
      width: 160,
      render: (_, r) => (
        <Space size={0}>
          <Button
            type="link"
            onClick={() => {
              setEditing(r);
              setOpen(true);
            }}
          >
            编辑详情
          </Button>
          <ConfirmAction
            label="删除"
            title="确认删除术语？前台将不再展示。"
            danger
            onConfirm={() => void run(() => remove('glossary/' + r.id), '术语已删除')}
          />
        </Space>
      ),
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="CONTENT MANAGEMENT"
        title="术语库"
        description="统一术语定义与阅读方式，帮助用户理解市场信号。"
        actions={
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            增加术语
          </Button>
        }
      />
      <Panel className="filter-panel">
        <div className="filters-row">
          <FilterField label="术语 / 中文">
            <FilterInput value={draft} onChange={setDraft} placeholder="搜索术语或中文名称" />
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
      <Panel title="术语列表" description="前台只展示已发布术语">
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
        title={editing ? '编辑术语 · ' + editing.id : '增加术语'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText="保存"
        cancelText="取消"
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const result = await run(
              () => (editing ? patch('glossary/' + editing.id, values) : post('glossary', values)),
              '术语已保存',
            );
            if (result) setOpen(false);
          }}
        >
          <div className="form-two">
            <Form.Item
              name="term"
              label="术语"
              rules={[{ required: true, whitespace: true, message: '请输入术语' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="name"
              label="中文"
              rules={[{ required: true, whitespace: true, message: '请输入中文名称' }]}
            >
              <Input />
            </Form.Item>
          </div>
          <div className="form-two">
            <Form.Item name="cat" label="分类" rules={[{ required: true }]}>
              <Select options={categories.map((value) => ({ value, label: value }))} />
            </Form.Item>
            <Form.Item name="status" label="发布状态">
              <Select
                options={[
                  { value: 'published', label: '已发布' },
                  { value: 'draft', label: '草稿' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item
            name="def"
            label="定义"
            rules={[{ required: true, whitespace: true, message: '请输入定义' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="read"
            label="怎么读"
            rules={[{ required: true, whitespace: true, message: '请输入阅读说明' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
