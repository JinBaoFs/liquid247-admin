import { lazy, Suspense } from 'react';
import { Skeleton } from 'antd';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './app/auth';
import Layout, { Guard, HomeRedirect } from './app/Layout';
const Login = lazy(() => import('./features/Login'));
const Overview = lazy(() => import('./features/Overview'));
const Alerts = lazy(() => import('./features/Alerts'));
const AlertEditor = lazy(() => import('./features/AlertEditor'));
const Glossary = lazy(() => import('./features/Glossary'));
const Tokens = lazy(() => import('./features/Tokens'));
const Whales = lazy(() => import('./features/Whales'));
const Links = lazy(() => import('./features/Links'));
const Nodes = lazy(() => import('./features/Nodes'));
const Users = lazy(() => import('./features/Users'));
const Accounts = lazy(() => import('./features/Accounts'));
const Audit = lazy(() => import('./features/Audit'));
export default function Application() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense
          fallback={
            <div className="boot">
              <Skeleton active />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<Layout />}>
              <Route index element={<HomeRedirect />} />
              <Route
                path="overview"
                element={
                  <Guard module="overview">
                    <Overview />
                  </Guard>
                }
              />
              <Route
                path="alerts"
                element={
                  <Guard module="content">
                    <Alerts />
                  </Guard>
                }
              />
              <Route
                path="alerts/:id"
                element={
                  <Guard module="content">
                    <AlertEditor />
                  </Guard>
                }
              />
              <Route
                path="glossary"
                element={
                  <Guard module="content">
                    <Glossary />
                  </Guard>
                }
              />
              <Route
                path="tokens"
                element={
                  <Guard module="website">
                    <Tokens />
                  </Guard>
                }
              />
              <Route
                path="whales"
                element={
                  <Guard module="website">
                    <Whales />
                  </Guard>
                }
              />
              <Route
                path="links"
                element={
                  <Guard module="website">
                    <Links />
                  </Guard>
                }
              />
              <Route
                path="nodes"
                element={
                  <Guard module="overview">
                    <Nodes />
                  </Guard>
                }
              />
              <Route
                path="users"
                element={
                  <Guard module="users">
                    <Users />
                  </Guard>
                }
              />
              <Route
                path="accounts"
                element={
                  <Guard module="system" superOnly>
                    <Accounts />
                  </Guard>
                }
              />
              <Route
                path="audit"
                element={
                  <Guard module="system">
                    <Audit />
                  </Guard>
                }
              />
              <Route
                path="*"
                element={
                  <div className="no-access">
                    <h2>页面不存在</h2>
                    <a href="/admin">返回工作台</a>
                  </div>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
