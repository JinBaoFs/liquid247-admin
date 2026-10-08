import { useEffect, useState } from 'react';
import {
  App,
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import {
  ArrowLeft,
  Bookmark,
  Eye,
  Save,
  Send,
  Clock,
  LockKeyhole,
  Waves,
  CalendarClock,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';
import { ALERT_TYPES, type PageResult, type Row } from '../types';
import { api, patch, post } from '../services/api';
import { dateTime, PageHead, Panel, Status, useAction, useData } from '../components/shared';
import RichTextEditor from '../components/RichTextEditor';
import { RichTextView } from '../content/RichTextView';
import { emptyDoc, hasRichText, richTextPlain } from '../content/rich-text';
export default function AlertEditor() {
  const { modal } = App.useApp();
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [record, setRecord] = useState<Row | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<Dayjs | null>(dayjs().add(1, 'hour'));
  const [scheduleError, setScheduleError] = useState('');
  const { run, busy } = useAction();
  const { data: tokens } = useData<PageResult>('tokens?pageSize=200');
  const watchedDoc = Form.useWatch('body_doc', form);
  useEffect(() => {
    let active = true;
    setError('');
    if (isNew) {
      setRecord(null);
      setLoading(false);
      form.resetFields();
      return;
    }
    setLoading(true);
    api<Row>('alerts/' + id)
      .then((row) => {
        if (active) {
          setRecord(row);
          form.setFieldsValue(row);
        }
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
  }, [id]);
  useEffect(() => {
    if (!record?.scheduled_at) return;
    const timer = setInterval(() => {
      void api<Row>('alerts/' + record.id)
        .then((next) => {
          setRecord(next);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [record?.id, record?.scheduled_at]);
  const save = async () => {
    const values = await form.validateFields();
    const payload = { ...values, body: richTextPlain(values.body_doc) };
    const result = await run(
      async () => {
        if (isNew) return post<Row>('alerts', payload);
        await patch('alerts/' + id, payload);
        return api<Row>('alerts/' + id);
      },
      record?.status === 'published' ? '已保存并更新发布内容' : '情报已保存',
    );
    if (result) {
      setRecord(result);
      if (isNew) navigate('/admin/alerts/' + result.id, { replace: true });
    }
    return result;
  };
  const change = async (action: string) => {
    const saved = action === 'unpublish' || action === 'cancel-schedule' ? record : await save();
    if (!saved) return;
    const result = await run(
      async () => {
        await post('alerts/' + saved.id + '/' + action);
        return api<Row>('alerts/' + saved.id);
      },
      action === 'publish'
        ? '情报已发布'
        : action === 'unpublish'
          ? '情报已下架'
          : '已取消定时发布',
    );
    if (result) setRecord(result);
  };
  const schedule = async () => {
    if (!scheduledTime || scheduledTime.valueOf() <= Date.now()) {
      setScheduleError('请选择晚于当前时间的发布时间');
      return;
    }
    let saved: Row | undefined;
    try {
      saved = await save();
    } catch {
      return;
    }
    if (!saved) return;
    const result = await run(async () => {
      await post('alerts/' + saved.id + '/schedule', { scheduled_at: scheduledTime.toISOString() });
      return api<Row>('alerts/' + saved.id);
    }, '已设置定时发布');
    if (result) {
      setRecord(result);
      setScheduleOpen(false);
    }
  };
  if (loading) return <Skeleton active />;
  if (error) return <Alert type="error" showIcon title={error} />;
  const values = form.getFieldsValue();
  return (
    <>
      <PageHead
        eyebrow="CONTENT MANAGEMENT / EDITOR"
        title={isNew ? '新建情报' : '编辑情报'}
        description="使用文本格式表达清晰的市场情报，管理发布与下架。"
        actions={
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/alerts')}>
            返回列表
          </Button>
        }
      />
      <div className="editor-layout">
        <Panel
          title="情报内容"
          extra={
            record ? (
              <span className="editor-id">
                ID <b className="mono">{record.id}</b>
              </span>
            ) : (
              <Tag>保存后生成数字 ID</Tag>
            )
          }
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ type: 'wall', token: 'BTC', body_doc: emptyDoc() }}
            className="editor-form"
          >
            <div className="form-two">
              <Form.Item
                label="情报类型"
                name="type"
                rules={[{ required: true, message: '请选择类型' }]}
              >
                <Select
                  options={Object.entries(ALERT_TYPES).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
              <Form.Item
                label="Token"
                name="token"
                rules={[{ required: true, message: '请选择 Token' }]}
              >
                <Select
                  showSearch
                  options={
                    tokens?.items
                      .filter((t) => t.status === 'active' || t.symbol === record?.token)
                      .map((t) => ({ label: t.symbol + ' · ' + t.name, value: t.symbol })) || []
                  }
                />
              </Form.Item>
            </div>
            <Form.Item
              label="标题"
              name="headline"
              rules={[
                { required: true, whitespace: true, message: '请输入标题' },
                { max: 160, message: '标题最多 160 字' },
              ]}
            >
              <Input placeholder="用一句话概括情报内容" maxLength={160} showCount />
            </Form.Item>
            <Form.Item
              label="正文"
              name="body_doc"
              required
              rules={[
                {
                  validator: (_, value) =>
                    value && hasRichText(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('请输入正文内容，空段落或仅格式内容不能保存')),
                },
              ]}
            >
              <RichTextEditor disabled={busy} />
            </Form.Item>
            <Form.Item label="观察解读" name="insight">
              <Input.TextArea rows={3} placeholder="补充该信号的观察角度" />
            </Form.Item>
            <div className="published-time-row">
              <span>发布时间</span>
              <b>{dateTime(record?.time)}</b>
              <small>
                {record?.time ? '再次发布时会更新发布时间。' : '正式发布后生成，定时安排单独管理。'}
              </small>
            </div>
          </Form>
        </Panel>
        <div className="editor-side">
          <Panel title="发布管理">
            <div className="publish-status">
              <span>当前状态</span>
              <Space size={4}>
                <Status value={record?.status || 'unpublished'} />
                {record?.dataDelayed && (
                  <Tag color="orange" style={{ margin: 0 }}>
                    数据延迟
                  </Tag>
                )}
              </Space>
            </div>
            <div className="editor-buttons">
              <Button
                icon={<Save size={16} />}
                loading={busy}
                onClick={() => void save().catch(() => {})}
                block
              >
                {record?.status === 'published' ? '保存并更新' : '保存情报'}
              </Button>
              {record?.status === 'published' ? (
                <Button
                  danger
                  disabled={busy}
                  onClick={() =>
                    modal.confirm({
                      title: '确认下架这条情报？',
                      content: '下架后前台不再展示，历史内容与统计保留。',
                      okText: '下架',
                      cancelText: '取消',
                      onOk: () => change('unpublish'),
                    })
                  }
                  block
                >
                  下架情报
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<Send size={16} />}
                  disabled={busy}
                  onClick={() => void change('publish').catch(() => {})}
                  block
                >
                  {record?.status === 'offline' ? '再次发布' : '立即发布'}
                </Button>
              )}
              {(!record || record.status === 'unpublished') && (
                <Button
                  icon={<Clock size={16} />}
                  disabled={busy}
                  onClick={() => {
                    setScheduledTime(
                      record?.scheduled_at ? dayjs(record.scheduled_at) : dayjs().add(1, 'hour'),
                    );
                    setScheduleError('');
                    setScheduleOpen(true);
                  }}
                  block
                >
                  {record?.scheduled_at ? '调整定时发布' : '定时发布'}
                </Button>
              )}
              <Button icon={<Eye size={16} />} onClick={() => setPreview(true)} block>
                前台预览
              </Button>
            </div>
            {record?.scheduled_at && (
              <div className="schedule-card">
                <div>
                  <CalendarClock size={15} />
                  <b>待执行的发布安排</b>
                </div>
                <p>{dateTime(record.scheduled_at)}</p>
                <span>当前状态保持未发布</span>
                <Button
                  type="link"
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    modal.confirm({
                      title: '取消这条情报的定时发布？',
                      okText: '取消安排',
                      cancelText: '返回',
                      onOk: () => change('cancel-schedule'),
                    })
                  }
                >
                  取消定时发布
                </Button>
              </div>
            )}
          </Panel>
          <Panel title="内容表现">
            <div className="content-stat">
              <span>
                <Eye size={16} />
                点击量
              </span>
              <b>{record?.clicks?.toLocaleString() || 0}</b>
            </div>
            <div className="content-stat">
              <span>
                <Bookmark size={16} />
                收藏量
              </span>
              <b>{record?.favorites || 0}</b>
            </div>
            <p className="muted small">统计数据只读，由用户行为产生。</p>
          </Panel>
          <Panel title="冻结快照" extra={<LockKeyhole size={15} />}>
            <p className="muted small">盘口数字不在此页直接修改，需走更正流程。</p>
            {record?.snapshot ? (
              <Descriptions
                column={1}
                size="small"
                items={[
                  { key: 'price', label: '价格', children: record.snapshot.price },
                  {
                    key: 'bid',
                    label: '买侧深度',
                    children: record.snapshot.bidDepth.toLocaleString(),
                  },
                  {
                    key: 'ask',
                    label: '卖侧深度',
                    children: record.snapshot.askDepth.toLocaleString(),
                  },
                  {
                    key: 'time',
                    label: '采集时间',
                    children: dateTime(record.snapshot.capturedAt),
                  },
                ]}
              />
            ) : (
              <p className="muted small">此条人工情报没有盘口快照。</p>
            )}
          </Panel>
        </div>
      </div>
      <Modal
        open={scheduleOpen}
        onCancel={() => setScheduleOpen(false)}
        title="安排定时发布"
        okText="保存并安排发布"
        cancelText="取消"
        confirmLoading={busy}
        onOk={() => void schedule()}
      >
        <p className="muted small">情报在计划执行前保持未发布，发布时间在正式发布时生成。</p>
        <label className="rich-link-label" htmlFor="scheduled-at">
          计划发布时间
        </label>
        <DatePicker
          id="scheduled-at"
          aria-label="计划发布时间"
          showTime
          format="YYYY-MM-DD HH:mm:ss"
          value={scheduledTime}
          onChange={(value) => {
            setScheduledTime(value);
            setScheduleError('');
          }}
          disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          style={{ width: '100%' }}
          status={scheduleError ? 'error' : undefined}
        />
        {scheduleError && <p className="rich-link-error">{scheduleError}</p>}
      </Modal>
      <Modal
        open={preview}
        onCancel={() => setPreview(false)}
        footer={<Button onClick={() => setPreview(false)}>关闭预览</Button>}
        width={760}
        title="前台内容预览"
      >
        <article className="alert-preview">
          <div className="preview-brand">
            <Waves size={20} />
            LIQUID247<span>仅后台可见的内容预览</span>
          </div>
          <div className="preview-meta">
            <Tag>{values.token || record?.token}</Tag>
            {record?.dataDelayed && <Tag color="orange">数据延迟</Tag>}
            <span>
              {ALERT_TYPES[(values.type || record?.type || 'wall') as keyof typeof ALERT_TYPES]}
            </span>
            <span>{record?.time ? dateTime(record.time) : '尚未发布'}</span>
          </div>
          <h2>{values.headline || '未填写标题'}</h2>
          <RichTextView value={watchedDoc || values.body_doc || emptyDoc()} />
          {values.insight && <blockquote>{values.insight}</blockquote>}
        </article>
      </Modal>
    </>
  );
}
