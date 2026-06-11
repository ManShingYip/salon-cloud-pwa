/**
 * AdminGuard — 店長權限守衛 + 美觀無權限提示
 *
 * 用法:
 *   <AdminGuard>
 *     <AdminOnlyPage />
 *   </AdminGuard>
 *
 * 若使用者非店長 → 顯示美觀提示頁（保留導覽，不會卡死）
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldExclamationIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Alert } from 'flowbite-react';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

const AdminGuard = ({ children, fallbackMessage }) => {
  const { isOwner } = useAuth();
  const navigate = useNavigate();

  if (isOwner) return children;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-6">
        <ShieldExclamationIcon className="w-14 h-14" />
      </div>
      <h2 className="text-2xl font-bold text-text mb-3">權限不足</h2>
      <p className="text-text-muted text-lg mb-2 max-w-md">
        {fallbackMessage || '此頁面僅限店長查閱。如你認為這是錯誤，請聯繫店長調整你的帳號權限。'}
      </p>
      <p className="text-text-muted text-sm mb-8">
        你目前是 <b>美容師</b> 角色，只能查看預約、客戶及結算相關頁面。
      </p>
      <div className="flex gap-4">
        <Button variant="secondary" icon={ArrowLeftIcon} onClick={() => navigate(-1)}>
          返回上一頁
        </Button>
        <Button variant="primary" onClick={() => navigate('/')}>
          回到儀表板
        </Button>
      </div>

      {/* 仍列出可存取的頁面，讓使用者不會卡住 */}
      <div className="mt-10 p-6 bg-surface rounded-2xl shadow-card max-w-md w-full text-left">
        <h4 className="font-bold mb-3">✅ 你可使用的功能：</h4>
        <ul className="space-y-2 text-sm text-text-muted">
          <li>🏠 儀表板總覽</li>
          <li>📅 今日預約管理</li>
          <li>👥 客戶查詢</li>
          <li>📋 訂單管理檢視</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminGuard;
