import { plainTextToDoc } from '../content/rich-text';
import type { Database, Row } from '../types';
const iso = (date: Date) => date.toISOString();
const ago = (days: number, hour = 10) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return iso(d);
};
export function createSeed(): Database {
  const tokenSeeds = [
    ['BTC', '比特币', 'BTCUSDT', 'crypto'],
    ['ETH', '以太坊', 'ETHUSDT', 'crypto'],
    ['SOL', 'Solana', 'SOLUSDT', 'crypto'],
    ['HYPE', 'Hyperliquid', 'HYPE/USDC', 'crypto'],
    ['XRP', '瑞波币', 'XRPUSDT', 'crypto'],
    ['DOGE', '狗狗币', 'DOGEUSDT', 'crypto'],
    ['BNB', 'BNB', 'BNBUSDT', 'crypto'],
    ['XAU', '黄金', 'GC', 'trad'],
    ['SUI', 'Sui', 'SUIUSDT', 'crypto'],
    ['AVAX', 'Avalanche', 'AVAXUSDT', 'crypto'],
  ];
  const tokens = tokenSeeds.map((t, i) => ({
    id: i + 1,
    symbol: t[0],
    name: t[1],
    pair: t[2],
    world: t[3],
    assetClass: t[3] === 'trad' ? 'commodity' : 'crypto',
    unit: 'USD',
    status: i === 9 ? 'disabled' : 'active',
  }));
  const titles = [
    '近端买盘出现大额限价单墙，支撑区域值得关注',
    '主动买单连续扫过近端卖盘，短时成交放大',
    '近端卖墙大幅撤单，盘口阻力暂时回落',
    '近端卖盘出现深度断层，价格冲击风险上升',
    '价格走高而累计成交量差回落，买盘出现背离',
    '巨鲸地址新增多头仓位，持仓规模明显扩大',
    '近端盘口深度回升，买卖两侧流动性趋于平衡',
  ];
  const types = ['wall', 'sweep', 'spoof', 'gap', 'divergence', 'whale', 'depth'];
  const statuses = [
    'published',
    'published',
    'unpublished',
    'published',
    'unpublished',
    'unpublished',
    'offline',
    'published',
  ];
  const alerts: Row[] = Array.from({ length: 84 }, (_, i) => {
    const type = types[i % 7];
    const token = tokens[i % 9].symbol;
    const status = statuses[i % 8];
    const time = ['published', 'offline'].includes(status)
      ? ago(Math.floor(i / 2), 9 + (i % 9))
      : null;
    const scheduled_at = i % 8 === 5 ? ago(-1, 14) : null;
    return {
      id: 2293369 + i,
      type,
      tag: '订单流',
      stance: i % 3 === 0 ? '偏多' : i % 3 === 1 ? '中性' : '偏空',
      token,
      exchange_id: i % 2 ? 8 : 1,
      venues: [i % 2 ? 'Hyperliquid' : 'Binance 现货'],
      time,
      scheduled_at,
      notional: 2400000 + i * 17400,
      headline: token + ' ' + titles[i % 7],
      body:
        token +
        ' 在' +
        (i % 2 ? ' Hyperliquid' : ' Binance 现货') +
        ' 的近端盘口出现明显变化。连续观察窗口内，订单流与深度结构发生调整，主要集中于当前价格附近。\n\n该信号来自冻结的盘口快照。应结合后续成交与撤单情况观察，单次盘口变化不代表价格方向已经确认。',
      insight: '关注近端流动性的持续性与主动成交方向。',
      snapshot: {
        price: token === 'BTC' ? 62480.5 : token === 'ETH' ? 2486.2 : 148.73,
        bidDepth: 4280000 + i * 12300,
        askDepth: 3760000 + i * 8100,
        capturedAt: ago(Math.floor(i / 2)),
      },
      visual: 'depth',
      whale_id: type === 'whale' ? 1001 + (i % 8) : null,
      related: [2293369 + ((i + 1) % 84)],
      status,
      clicks: status === 'published' || status === 'offline' ? 158 + i * 27 : 0,
      favorites: status === 'published' || status === 'offline' ? 8 + (i % 29) : 0,
      everPublished: status === 'published' || status === 'offline',
      archived: false,
      updated_at: ago(Math.floor(i / 2)),
    };
  });
  alerts.forEach((alert) => {
    alert.body_doc = plainTextToDoc(alert.body);
  });
  const whales = Array.from({ length: 8 }, (_, i) => ({
    id: 1001 + i,
    address: '0x' + (i + 17).toString(16).padStart(2, '0').repeat(20),
    label: ['Atlas', 'Orion', '鲸鱼 03', 'Meridian', '鲸鱼 05', 'Nova', '鲸鱼 07', '鲸鱼 08'][i],
    venue_id: 8,
    venue: 'Hyperliquid',
    win_rate: i === 6 ? null : 52.3 + i * 4.1,
    pnl_30d: i === 4 ? -128700 : 247600 + i * 126300,
  }));
  const glossarySeeds = [
    [
      'CVD',
      '累计成交量差',
      '订单流',
      '主动买入成交量与主动卖出成交量的累计差值。',
      'CVD 持续上升说明主动买入较强，需结合价格走势理解。',
    ],
    [
      'Bid Wall',
      '买单墙',
      '盘口结构',
      '买方某个价格附近集中出现的大额限价委托。',
      '关注挂单是否持续，以及实际成交后是否继续补单。',
    ],
    [
      'Ask Wall',
      '卖单墙',
      '盘口结构',
      '卖方某个价格附近集中出现的大额限价委托。',
      '挂单可以撤销，不能单独视为确定的阻力。',
    ],
    [
      'Sweep',
      '扫盘',
      '订单流',
      '主动订单连续吃掉多个价位的被动委托。',
      '结合成交规模、方向和价格冲击观察。',
    ],
    [
      'Spoof',
      '撤单信号',
      '盘口结构',
      '大额挂单在成交前明显撤走的盘口变化信号。',
      '信号本身不证明参与者存在操纵意图。',
    ],
    [
      'Depth Gap',
      '深度断层',
      '盘口结构',
      '相邻价位间可成交流动性明显不足。',
      '流动性薄弱区间可能放大价格冲击。',
    ],
    [
      'Divergence',
      '背离',
      '跨市场',
      '价格与订单流指标方向不一致。',
      '观察背离是否持续，不能直接当作反转确认。',
    ],
    [
      'Funding Rate',
      '资金费率',
      '杠杆与风险',
      '永续合约多空双方周期性支付的费用。',
      '资金费率偏高通常意味着多头持仓成本增加。',
    ],
    [
      'Open Interest',
      '未平仓量',
      '杠杆与风险',
      '尚未平仓的合约持仓总量。',
      '配合价格、成交量识别新增持仓和离场。',
    ],
    ['Bullish', '偏多', '倾向标签', '信号显示买方力量相对占优。', '这是信号倾向，不是交易建议。'],
    ['Bearish', '偏空', '倾向标签', '信号显示卖方力量相对占优。', '这是信号倾向，不是交易建议。'],
    [
      'Spread',
      '买卖价差',
      '盘口结构',
      '最优卖价与最优买价之间的差。',
      '价差扩大可能表示流动性下降。',
    ],
  ];
  const glossary = glossarySeeds.map((t, i) => ({
    id: i + 1,
    term: t[0],
    name: t[1],
    cat: t[2],
    def: t[3],
    read: t[4],
    status: i === 11 ? 'draft' : 'published',
  }));
  const nodes = [
    'Binance 现货 WS',
    'Binance 永续 WS',
    'Hyperliquid info',
    'Hyperliquid fills',
    'OKX 现货 REST',
    'Coinbase WS',
  ].map((name, i) => ({
    id: i + 1,
    name,
    coverage: [
      'BTC / ETH / SOL',
      'BTC / ETH',
      'HYPE / BTC / ETH',
      '巨鲸成交',
      'BTC / ETH / XRP',
      'BTC / ETH',
    ][i],
    latency: [42, 68, 126, 243, 87, 0][i],
    heartbeatAge: [1, 1, 2, 12, 2, 70][i],
    status: i === 3 ? 'degraded' : i === 5 ? 'down' : 'active',
    lastChecked: ago(0),
    enabled: true,
  }));
  const links = [
    ['Binance 现货行情', '行情 WS', 'wss://stream.binance.com:9443/ws', 'Binance 现货'],
    ['Binance 永续行情', '行情 WS', 'wss://fstream.binance.com/ws', 'Binance 永续'],
    ['Hyperliquid info', 'REST', 'https://api.hyperliquid.xyz/info', 'Hyperliquid'],
    ['Hyperliquid fills', '行情 WS', 'wss://api.hyperliquid.xyz/ws', 'Hyperliquid'],
    ['TradingView 对照', '对照', 'https://www.tradingview.com', 'TradingView'],
    ['情报详情路由', '站内路由', '/alerts/:id', '站内'],
    ['图表脚本', '脚本', '/assets/charts.js', '站内'],
    ['网站字体', '字体', '/assets/fonts/inter.woff2', '站内'],
  ].map((t, i) => ({
    id: i + 1,
    name: t[0],
    kind: t[1],
    url: t[2],
    venue: t[3],
    enabled: i !== 3,
    probeStatus: i === 3 ? 'failed' : 'success',
    latency: i === 3 ? 0 : 28 + i * 13,
    secretRef: i === 2 ? 'secret://liquid247/hyperliquid' : null,
    lastChecked: ago(0),
  }));
  const users = Array.from({ length: 180 }, (_, i) => ({
    id: 100001 + i,
    email: 'trader' + (i + 1) + '@example.com',
    nickname:
      ['流动性观察者', '北极星', '阿尔法', '链上漫游者', '订单流研究员', 'Satoshi'][i % 6] +
      (i + 1),
    watchlist: ['BTC', 'ETH', ...(i % 2 ? ['SOL'] : [])],
    saved: alerts
      .filter((a) => a.status === 'published')
      .slice(i % 10, (i % 10) + 1 + (i % 6))
      .map((a) => a.id),
    tokenThresholds: { BTC: 1000000, ETH: 500000 },
    settings: { language: 'zh-CN', theme: 'light', notifications: i % 3 !== 0 },
    registered_at: ago(Math.floor(i / 2)),
    last_login_at: ago(i % 42, i % 20),
    status: i % 19 === 0 ? 'disabled' : 'active',
  }));
  const daily = Array.from({ length: 90 }, (_, i) => {
    const d = ago(89 - i);
    return {
      id: i + 1,
      date: d.slice(0, 10),
      pv: 1700 + ((i * 173) % 1600),
      uv: 520 + ((i * 97) % 590),
      favorites: 12 + (i % 27),
    };
  });
  const accounts = [
    {
      id: 1,
      email: 'admin@liquid247.xyz',
      name: '超级管理员',
      role: 'super' as const,
      enabled: true,
    },
    {
      id: 2,
      email: 'editor@liquid247.xyz',
      name: '内容运营',
      role: 'content' as const,
      enabled: true,
    },
  ];
  const audit = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    time: ago(Math.floor(i / 3), 18 - (i % 5)),
    account: '超级管理员',
    email: accounts[0].email,
    role: 'super',
    action: ['发布情报', '保存情报', '探测链接'][i % 3],
    object_id: i % 3 === 2 ? 1 : 2293369 + i,
    before: i % 3 === 0 ? { status: 'saved' } : {},
    after: i % 3 === 0 ? { status: 'published' } : {},
    note: '初始化演示记录',
  }));
  return {
    version: 2,
    alerts,
    glossary,
    tokens,
    whales,
    links,
    nodes,
    users,
    accounts,
    audit,
    daily,
    sessions: {},
    permissions: ['content', 'website', 'overview'],
    nodeConfig: {
      interval: 20,
      latencyThreshold: 200,
      degradedAfter: 10,
      downAfter: 60,
      policy: 'stop',
    },
  };
}
