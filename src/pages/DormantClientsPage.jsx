/**
 * 沉睡客戶列表頁面 (店長權限)
 * 自動識別 90 天內無預約的客戶，並提供一鍵提醒功能
 */
import React, { useState, useEffect } from 'react';
import { Table, Badge, Spinner, Alert } from 'flowbite-react';
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
          <Table hoverable>
            <Table.Head className="bg-bg">
              <Table.HeadCell>客戶姓名</Table.HeadCell>
              <Table.HeadCell>會員編號</Table.HeadCell>
              <Table.HeadCell>最後到訪日</Table.HeadCell>
              <Table.HeadCell>沉睡天數</Table.HeadCell>
              <Table.HeadCell className="text-right">操作</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {clients.map(c => {
                const dormantDays = c.dormant_days || Math.floor((new Date() - new Date(c.last_visit_date)) / (1000 * 60 * 60 * 24));
                return (
                  <Table.Row key={c.id}>
                    <Table.Cell className="font-bold text-text">{c.name}</Table.Cell>
                    <Table.Cell>{c.member_id}</Table.Cell>
                    <Table.Cell>{c.last_visit_date}</Table.Cell>
                    <Table.Cell>
                      <Tag color={dormantDays > 180 ? 'amber' : 'gray'}>沉睡 {dormantDays} 天</Tag>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button 
                        variant="secondary" 
                        size="md" 
                        icon={ChatBubbleLeftRightIcon}
                        onClick={() => handleRemind(c)}
                      >
                        發送提醒
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {clients.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={5} className="text-center py-10 text-text-muted italic">
                    恭喜！目前沒有沉睡超過 90 天的客戶。
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </div>
    </div>
  );
};

export default DormantClientsPage;
