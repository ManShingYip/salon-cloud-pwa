/**
 * 活動日誌頁面 (店長權限)
 * 紀錄所有關鍵操作，如扣數、新增客戶、修改預約等
 */
import React, { useState, useEffect } from 'react';
import { Table, TextInput, Select, Spinner, Card } from 'flowbite-react';
import { MagnifyingGlassIcon, ClipboardDocumentListIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Tag from '@/components/ui/Tag';

const ActivityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', query: '' });

  useEffect(() => {
    fetchLogs();
  }, [filter.type]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase.from('activity_log').select(`*, profiles(name)`).order('created_at', { ascending: false }).limit(50);
    if (filter.type) query = query.eq('action_type', filter.type);
    
    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  const getActionColor = (type) => {
    if (type.includes('deduct')) return 'rose';
    if (type.includes('create')) return 'green';
    if (type.includes('delete')) return 'gray';
    return 'blue';
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-8 h-8 text-primary" />
            系統活動日誌
          </h1>
          <p className="text-text-muted">追蹤美容師的操作行為，確保營運合規</p>
        </div>
        <button 
          onClick={fetchLogs}
          className="p-3 text-primary hover:bg-primary-light/20 rounded-xl transition-all"
          title="重新整理"
        >
          <ArrowPathIcon className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput 
            placeholder="搜尋操作者、內容關鍵字..." 
            className="pl-10"
            value={filter.query}
            onChange={(e) => setFilter({...filter, query: e.target.value})}
          />
        </div>
        <Select 
          className="w-48"
          value={filter.type}
          onChange={(e) => setFilter({...filter, type: e.target.value})}
        >
          <option value="">所有類型</option>
          <option value="deduct_service">療程扣減</option>
          <option value="create_appointment">新增預約</option>
          <option value="update_client">修改客戶</option>
          <option value="finalize_settlement">每日結算</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : (
          <Table hoverable>
            <Table.Head className="bg-bg">
              <Table.HeadCell>時間</Table.HeadCell>
              <Table.HeadCell>操作類型</Table.HeadCell>
              <Table.HeadCell>操作者</Table.HeadCell>
              <Table.HeadCell>詳細內容</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {logs.map(log => (
                <Table.Row key={log.id}>
                  <Table.Cell className="text-sm">
                    {new Date(log.created_at).toLocaleString('zh-HK', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Table.Cell>
                  <Table.Cell>
                    <Tag color={getActionColor(log.action_type)}>{log.action_type_label || log.action_type}</Tag>
                  </Table.Cell>
                  <Table.Cell className="font-bold">{log.profiles?.name || '系統'}</Table.Cell>
                  <Table.Cell className="text-sm text-text-muted">{log.details}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default ActivityLogPage;
