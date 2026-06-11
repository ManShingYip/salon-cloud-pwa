/**
 * 主應用程式路由配置
 * React Router v6 + Supabase Auth + AuthContext
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Spinner } from 'flowbite-react';
import AppLayout from '@/components/layout/AppLayout';
import AdminGuard from '@/components/ui/AdminGuard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import LoginPage from '@/pages/LoginPage';

// Pages
import DashboardPage from '@/pages/DashboardPage';
import DailyAppointmentsPage from '@/pages/DailyAppointmentsPage';
import NewAppointmentPage from '@/pages/NewAppointmentPage';
import EditAppointmentPage from '@/pages/EditAppointmentPage';
import DailySettlementPage from '@/pages/DailySettlementPage';
import ClientListPage from '@/pages/ClientListPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import TreatmentManagePage from '@/pages/TreatmentManagePage';
import StaffSchedulePage from '@/pages/StaffSchedulePage';
import ActivityLogPage from '@/pages/ActivityLogPage';
import DormantClientsPage from '@/pages/DormantClientsPage';

const AppRoutes = () => {
  const { user, loading, isOwner } = useAuth();

  // 初始化中 — 顯示 loading
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner size="xl" color="pink" />
          <p className="text-text-muted">載入中...</p>
        </div>
      </div>
    );
  }

  // 未登入 — 顯示 LoginPage
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // 已登入 — 正常路由
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ErrorBoundary><AppLayout user={user} /></ErrorBoundary>}>
          <Route index element={<DashboardPage />} />
          <Route path="appointments" element={<DailyAppointmentsPage />} />
          <Route path="appointments/new" element={<NewAppointmentPage />} />
          <Route path="appointments/:id/edit" element={<EditAppointmentPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="settlement" element={<DailySettlementPage />} />

          {/* 店長權限路由 — 非店長會看到美觀提示頁 */}
          <Route path="treatments" element={<AdminGuard><TreatmentManagePage /></AdminGuard>} />
          <Route path="schedules" element={<AdminGuard><StaffSchedulePage /></AdminGuard>} />
          <Route path="logs" element={<AdminGuard><ActivityLogPage /></AdminGuard>} />
          <Route path="dormant" element={<AdminGuard><DormantClientsPage /></AdminGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;
