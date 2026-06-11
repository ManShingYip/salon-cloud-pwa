/**
 * App 佈局元件 - iPad 橫向優化
 * 包含 220px 左側 Sidebar 與內容區域
 */
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UsersIcon,
  SparklesIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  MoonIcon,
  ClockIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';

const AppLayout = ({ user }) => {
  const { signOut } = useAuth();
  const isOwner = user?.role === 'shop_owner';

  const allMenuItems = [
    { name: '儀表板', path: '/', icon: CalendarDaysIcon },
    { name: '今日預約', path: '/appointments', icon: CalendarDaysIcon },
    { name: '客戶管理', path: '/clients', icon: UsersIcon },
    { name: '療程管理', path: '/treatments', icon: SparklesIcon },
    { name: '收入紀錄', path: '/settlement', icon: BanknotesIcon },
    { name: '員工排班', path: '/schedules', icon: ClockIcon },
    { name: '活動日誌', path: '/logs', icon: ClipboardDocumentListIcon },
    { name: '沉睡客戶', path: '/dormant', icon: MoonIcon },
  ];

  return (
    <div className="flex h-screen w-full bg-bg">
      {/* Sidebar - 固定左側 220px */}
      <aside className="w-[220px] bg-surface flex flex-col border-r border-gray-100 shadow-sm z-20">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            Salon Cloud
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {allMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-h-[48px]
                ${isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'text-text-muted hover:bg-primary-light/30 active:bg-primary-light/50'}
              `}
            >
              <item.icon className="w-6 h-6" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 mt-auto border-t border-gray-50">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold">
              {user?.name?.[0] || '店'}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text truncate w-24">{user?.name}</span>
              <span className="text-xs text-text-muted">管理員</span>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-3 w-full px-4 py-3 text-danger hover:bg-red-50 rounded-xl transition-all">
            <ArrowLeftOnRectangleIcon className="w-6 h-6" />
            <span className="font-medium">登出</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 overflow-y-auto relative p-6 transform-gpu">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
