import { useState } from 'react';
import { Alert, DatePicker, Segmented, Skeleton, Tooltip } from 'antd';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Eye,
  Users,
  FileCheck2,
  UserRoundCheck,
  UserPlus,
  Bookmark,
  Info,
  CalendarDays,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import { PageHead, Panel, RefreshButton, useData } from '../components/shared';
import { ALERT_TYPES } from '../types';
const COLORS = ['#8057e8', '#a58af2', '#40baa5', '#65a3ea', '#f2b35f', '#e585ae', '#abb7c8'];
interface Summary {
  pv: number;
  uv: number;
  published: number;
  active: number;
  registered: number;
  favorites: number;
  daily: { date: string; pv: number; uv: number; registrations: number }[];
  distribution: { type: keyof typeof ALERT_TYPES; count: number }[];
}
export default function Overview() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()]);
  const [quick, setQuick] = useState<string>('7');
  const { data, loading, error, reload } = useData<Summary>(
    'dashboard?start=' + range[0].format('YYYY-MM-DD') + '&end=' + range[1].format('YYYY-MM-DD'),
  );
  const metrics = [
    { key: 'pv', label: '区间 PV', icon: Eye, note: '筛选区间内的页面浏览合计', color: 'purple' },
    {
      key: 'uv',
      label: '区间 UV',
      icon: Users,
      note: '筛选区间内每日独立访客数之和',
      color: 'blue',
    },
    {
      key: 'published',
      label: '已发布情报',
      icon: FileCheck2,
      note: '发布时间位于区间内且当前已发布',
      color: 'green',
    },
    {
      key: 'active',
      label: '活跃用户',
      icon: UserRoundCheck,
      note: '结束日回看 30 天有登录的正常账号',
      color: 'orange',
    },
    {
      key: 'registered',
      label: '注册用户总数',
      icon: UserPlus,
      note: '截至结束日累计注册的前台账号',
      color: 'pink',
    },
    {
      key: 'favorites',
      label: '收藏量总数',
      icon: Bookmark,
      note: '筛选区间内新增收藏合计',
      color: 'indigo',
    },
  ] as const;
  return (
    <>
      <PageHead
        eyebrow="DATA OVERVIEW"
        title="值班总览"
        description="掌握网站运行表现，让每一份情报的价值清晰可见。"
        actions={<RefreshButton onClick={reload} loading={loading} />}
      />
      <div className="overview-filter">
        <div className="date-filter-label">
          <CalendarDays size={17} />
          <span>统计区间</span>
        </div>
        <DatePicker.RangePicker
          value={range}
          allowClear={false}
          onChange={(v) => {
            if (v?.[0] && v[1]) {
              setRange([v[0], v[1]]);
              setQuick('custom');
            }
          }}
          disabledDate={(d) => d.isAfter(dayjs(), 'day')}
        />
        <Segmented
          value={quick}
          options={[
            { label: '近 7 日', value: '7' },
            { label: '近 30 日', value: '30' },
          ]}
          onChange={(v) => {
            setQuick(String(v));
            setRange([dayjs().subtract(Number(v) - 1, 'day'), dayjs()]);
          }}
        />
        <span className="filter-note">所有指标与图表随区间变化</span>
      </div>
      {error && <Alert type="error" title={error} showIcon />}
      <div className="metrics-grid">
        {metrics.map((metric) => (
          <div className="metric-card" key={metric.key}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <div className={'metric-icon ' + metric.color}>
                <metric.icon size={19} />
              </div>
            </div>
            {loading ? (
              <Skeleton.Input active size="small" />
            ) : (
              <div className="metric-value">
                {(data?.[metric.key] ?? 0).toLocaleString()}
                <span>
                  {['active', 'registered', 'uv'].includes(metric.key)
                    ? '人'
                    : metric.key === 'published'
                      ? '条'
                      : metric.key === 'favorites'
                        ? '次'
                        : '次'}
                </span>
              </div>
            )}
            <div className="metric-bottom">
              <span>{metric.note}</span>
              <Tooltip title={metric.note}>
                <Info size={13} />
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
      <div className="overview-charts">
        <Panel
          title="访问趋势"
          description="每日 PV / UV · 观察网站访问与阅读表现"
          extra={
            <div className="chart-legend">
              <span>
                <i style={{ background: '#8057e8' }} />
                PV
              </span>
              <span>
                <i style={{ background: '#40baa5' }} />
                UV
              </span>
            </div>
          }
        >
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart
                data={data?.daily || []}
                margin={{ top: 16, right: 18, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8057e8" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#8057e8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#efedf4" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => dayjs(v).format('MM/DD')}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#9794a6', fontSize: 11 }}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#9794a6', fontSize: 11 }}
                  width={48}
                />
                <ChartTooltip
                  labelFormatter={(v) => String(v)}
                  contentStyle={{ borderRadius: 10, border: '1px solid #ece8f5' }}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  name="PV"
                  dataKey="pv"
                  stroke="#8057e8"
                  strokeWidth={2.5}
                  fill="url(#pvGradient)"
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  name="UV"
                  dataKey="uv"
                  stroke="#40baa5"
                  strokeWidth={2.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="情报类型分布" description="区间内各类型已发布情报">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={185}>
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={data?.distribution || []}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={54}
                  outerRadius={76}
                  paddingAngle={3}
                  stroke="none"
                >
                  {COLORS.map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <ChartTooltip
                  formatter={(value, name) => [
                    value,
                    ALERT_TYPES[name as keyof typeof ALERT_TYPES],
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <b>{data?.distribution.reduce((sum, d) => sum + d.count, 0) || 0}</b>
              <span>已发布情报</span>
            </div>
          </div>
          <div className="distribution-legend">
            {(data?.distribution || []).map((d, i) => (
              <div key={d.type}>
                <span>
                  <i style={{ background: COLORS[i] }} />
                  {ALERT_TYPES[d.type]}
                </span>
                <b>{d.count}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="新增注册趋势"
        description="每日新增前台账号 · 了解用户增长变化"
        extra={
          <span className="chart-badge">
            区间新增 <b>{data?.daily.reduce((sum, d) => sum + d.registrations, 0) || 0}</b> 人
          </span>
        }
      >
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={data?.daily || []} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#efedf4" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => dayjs(v).format('MM/DD')}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#9794a6', fontSize: 11 }}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#9794a6', fontSize: 11 }}
                width={48}
              />
              <ChartTooltip contentStyle={{ borderRadius: 10, border: '1px solid #ece8f5' }} />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="registrations"
                name="新增注册"
                stroke="#8057e8"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="page-footnote">
        <Info size={14} />
        演示统计包含近 90 天数据；日期范围外无记录时显示 0。
      </div>
    </>
  );
}
