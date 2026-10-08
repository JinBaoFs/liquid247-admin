import { useState } from 'react';
import { Alert, Button, Form, Input, Segmented } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Waves, Activity, Database, Radar } from 'lucide-react';
import { useAuth } from '../app/auth';
export default function Login() {
  const { session, login, ready } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  if (ready && session) return <Navigate to="/admin" replace />;
  return (
    <div className="login-screen">
      <div className="login-story">
        <div className="brand login-brand">
          <span className="brand-mark">
            <Waves size={25} />
          </span>
          <div>
            LIQUID<span>247</span>
            <small>OPERATIONS CONSOLE</small>
          </div>
        </div>
        <div className="login-story-content">
          <span className="login-kicker">
            <span />
            ALWAYS ON. ALWAYS INFORMED.
          </span>
          <h1>
            把市场的每一次变化，
            <br />
            变成清晰的情报。
          </h1>
          <p>
            内容、数据与运营，在同一个工作台中协同。
            <br />
            让信息有序流动，让决策有据可依。
          </p>
          <div className="login-visual">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-center">
              <Waves size={54} />
            </div>
            <span className="visual-node node-one">
              <Activity size={22} />
              订单流
            </span>
            <span className="visual-node node-two">
              <Radar size={22} />
              监测池
            </span>
            <span className="visual-node node-three">
              <Database size={22} />
              情报
            </span>
            <svg className="visual-wave" viewBox="0 0 500 100">
              <path d="M0 75L45 75L60 60L80 60L95 82L125 15L150 80L175 60L205 60L225 44L250 44L272 70L300 70L320 35L335 55L370 55L390 75L450 75L500 60" />
            </svg>
          </div>
        </div>
        <div className="login-story-footer">
          LIQUID247.XYZ <span>网站运营后台</span>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <div className="login-shield">
            <ShieldCheck size={24} />
          </div>
          <h2>欢迎回到工作台</h2>
          <p className="login-description">使用后台账号登录 LIQUID247</p>
          <div className="demo-login-box">
            <span>选择演示角色</span>
            <Segmented
              block
              defaultValue="super"
              options={[
                { label: '超级管理员', value: 'super' },
                { label: '内容管理员', value: 'content' },
              ]}
              onChange={(v) => {
                form.setFieldsValue({
                  email: v === 'super' ? 'admin@liquid247.xyz' : 'editor@liquid247.xyz',
                  password: 'Demo247!',
                });
                setError('');
              }}
            />
            <small>
              演示密码：<code>Demo247!</code> · 可直接登录体验
            </small>
          </div>
          {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
          <Form
            form={form}
            layout="vertical"
            initialValues={{ email: 'admin@liquid247.xyz', password: 'Demo247!' }}
            onFinish={async (values) => {
              setLoading(true);
              setError('');
              try {
                await login(values.email, values.password);
                navigate('/admin', { replace: true });
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item
              label="后台邮箱"
              name="email"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效邮箱' },
              ]}
            >
              <Input size="large" placeholder="输入后台邮箱" autoComplete="username" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" autoComplete="current-password" placeholder="输入密码" />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit" block loading={loading}>
              登录工作台 <ArrowRight size={17} />
            </Button>
          </Form>
          <div className="login-security">
            <ShieldCheck size={14} />
            后台登录与网站前台账号独立
          </div>
        </div>
        <div className="login-form-footer">本地 Mock 环境 · 不连接真实业务服务</div>
      </div>
    </div>
  );
}
