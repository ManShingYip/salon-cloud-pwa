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
    if (filter.query) query = query.or(`action_type.ilike.%${filter.query}%,target_type.ilike.%${filter.query}%`);

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  };

  const actionLabels = {
    deduct_service: '療程扣減',
    complete_deduction: '扣減完成',
    create_appointment: '新增預約',
    cancel_appointment: '取消預約',
    update_client: '修改客戶',
    create_client: '新增客戶',
    finalize_settlement: '每日結算',
    grant_sessions: '新增療程',
    refund: '退款',
    revert_deduction: '退回扣減',
    revert_appointment: '退回預約',
  };
  const getActionLabel = (t) => actionLabels[t] || t;

  const getActionColor = (type) => {
    if (type.includes('deduct') || type.includes('revert')) return 'rose';
    if (type.includes('create') || type.includes('grant')) return 'green';
    if (type.includes('delete') || type.includes('cancel')) return 'gray';
    if (type.includes('finalize')) return 'amber';
    return 'blue';
  };

  // 將 JSONB details 轉為人可讀的中文鍵值對
  const formatDetails = (details) => {
    if (!details) return '-';
    let obj = details;
    if (typeof obj === 'string') {
      try { obj = JSON.parse(obj); } catch { return obj; }
    }
    if (typeof obj !== 'object') return String(obj);

    const map = {
      appointment_id: '預約 ID',
      client_service_id: '療程庫存 ID',
      treatment_name: '療程名稱',
      before_remaining: '扣前次數',
      after_remaining: '扣後次數',
      total_amount: '總金額',
      payment_method: '付款方式',
      transaction_id: '交易 ID',
      deducted_services: '已扣療程',
      settlement_date: '結算日期',
      reason: '原因',
      previous_status: '扣前狀態',
      new_status: '扣後狀態',
      restored_count: '已退回次數',
      restored_services_count: '已退回項數',
      voided_transaction_ids: '作廢交易 ID',
      refund_amount: '退款金額',
      restored_sessions: '已回補次數',
      sessions: '次數',
      unit_price: '單價',
      client_id: '客戶 ID',
      treatment_id: '療程 ID',
      staff_id: '美容師 ID',
      cash: '現金',
      card: '信用卡',
      transfer: '轉賬',
      other: '其他',
      note: '備註',
      message: '訊息',
    };

    const order = Object.keys(obj);
    const lines = order.map((key) => {
      const label = map[key] || key;
      const val = obj[key];
      let display = val;
      if (val && typeof val === 'object') {
        // 陣列 → 簡短顯示
        if (Array.isArray(val)) display = val.map(String).join(', ');
        else display = JSON.stringify(val);
      }
      return `${label}: ${display}`;
    });

    return lines.join('\n');
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

      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : logs.length > 0 ? (
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
                    <Tag color={getActionColor(log.action_type)}>{getActionLabel(log.action_type)}</Tag>
                  </Table.Cell>
                  <Table.Cell className="font-bold">{log.profiles?.name || '系統'}</Table.Cell>
                  <Table.Cell className="text-sm text-text-muted font-mono whitespace-pre-wrap max-w-[400px] text-xs leading-relaxed">
                    {formatDetails(log.details)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <div className="text-center py-20 text-text-muted">
            <ClipboardDocumentListIcon className="w-16 h-16 mx-auto opacity-20 mb-4" />
            <p className="text-lg">暫無活動紀錄</p>
            <p className="text-sm mt-2">當系統有扣數、退款、新增客戶等操作時，會自動記錄在此。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogPage;
