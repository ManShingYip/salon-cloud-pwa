/**
 * 沉睡客戶列表頁面 (店長權限)
 * 自動識別 90 天內無預約的客戶，並提供一鍵提醒功能
 */
import React, { useState, useEffect } from 'react';
import { Spinner, Alert } from 'flowbite-react';
import { MoonIcon, ChatBubbleLeftRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Modal from '@/components/ui/Modal';

const DormantClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDormantClients();
  }, []);

  const fetchDormantClients = async () => {
    setLoading(true);
    // 使用 dormant_clients View（已在 DB 定義）
    const { data } = await supabase.from('dormant_clients').select('*').order('dormant_days', { ascending: false });
    setClients(data || []);
    setLoading(false);
  };

  const handleRemind = (c) => {
    // 清理電話號碼格式（去 +852 / 空格 / 符號）
    const cleanPhone = (c.phone || '').replace(/[^\d]/g, '').replace(/^852/, '');
    const message = `親愛的 ${c.name}，好耐冇見啦！Salon Cloud 提醒您目前仲有療程未做完，而家預約即享驚喜優惠！`;
    window.open(`https://wa.me/852${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <MoonIcon className="w-8 h-8 text-primary" />
            沉睡客戶管理
          </h1>
          <p className="text-text-muted">自動找出超過 90 天未到訪的客戶，進行二次喚醒</p>
        </div>
      </header>

      <Alert color="info" className="bg-blue-50">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5" />
          <span>目前共有 <b>{clients.length}</b> 位客戶已超過 90 天未到店。</span>
        </div>
      </Alert>

      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                <th className="px-6 py-4 font-bold">客戶姓名</th>
                <th className="px-6 py-4 font-bold">會員編號</th>
                <th className="px-6 py-4 font-bold">最後到訪日</th>
                <th className="px-6 py-4 font-bold">沉睡天數</th>
                <th className="px-6 py-4 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(c => {
                const dormantDays = c.dormant_days || Math.floor((new Date() - new Date(c.last_visit_date)) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={c.id}>
                    <td className="px-6 py-4 font-bold text-text">{c.name}</td>
                    <td className="px-6 py-4">{c.member_id}</td>
                    <td className="px-6 py-4">{c.last_visit_date}</td>
                    <td className="px-6 py-4">
                      <Tag color={dormantDays > 180 ? 'amber' : 'gray'}>沉睡 {dormantDays} 天</Tag>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="md"
                        icon={ChatBubbleLeftRightIcon}
                        onClick={() => handleRemind(c)}
                      >
                        發送提醒
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-muted italic">
                    恭喜！目前沒有沉睡超過 90 天的客戶。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DormantClientsPage;
