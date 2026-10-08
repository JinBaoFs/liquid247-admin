import React from 'react';
import ReactDOM from 'react-dom/client';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import Application from './App';
import { worker } from './mocks/browser';
import './styles.css';
dayjs.locale('zh-cn');
async function start() {
  await worker.start({
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api/')) print.error();
    },
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConfigProvider
        button={{ autoInsertSpace: false }}
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#7d56df',
            colorInfo: '#7d56df',
            colorSuccess: '#26a58b',
            colorWarning: '#d89a33',
            colorError: '#df6371',
            fontFamily:
              'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
            fontSize: 13,
            borderRadius: 8,
            colorText: '#302c42',
            colorTextSecondary: '#8b869e',
            colorBorder: '#e7e3ee',
            controlHeight: 36,
          },
          components: {
            Table: {
              headerBg: '#faf9fc',
              headerColor: '#8b859b',
              headerSplitColor: 'transparent',
              cellPaddingBlock: 16,
            },
            Button: { primaryShadow: 'none' },
            Input: { activeShadow: '0 0 0 2px rgba(125,86,223,.08)' },
            Select: { activeOutlineColor: 'rgba(125,86,223,.08)' },
            Modal: { borderRadiusLG: 14 },
          },
        }}
      >
        <App>
          <Application />
        </App>
      </ConfigProvider>
    </React.StrictMode>,
  );
}
start().catch((error) => {
  document.getElementById('root')!.textContent = '模拟接口启动失败：' + error.message;
});
