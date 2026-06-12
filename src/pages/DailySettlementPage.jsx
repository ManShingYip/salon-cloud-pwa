/**
 * 訂單管理頁面 (Order Management)
 * 管理所有客戶購買的療程套票訂單，包含欠款追蹤、退款紀錄與多維度篩選。
 */
import React, { useState, useEffect, useMemo } from 'react';
import { TextInput, Select, Badge, Spinner } from 'flowbite-react';
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ClockIcon,
  NoSymbolIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import { exportSales } from '@/utils/exportExcel';

const OrderManagePage = () => {
  // --- State ---
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    staffId: '',
    search: ''
  });

  // Navigation Tabs: all | pending | completed | refunded
  const [activeTab, setActiveTab] = useState('all');
  const [activeChip, setActiveChip] = useState(null);

  // --- Data Fetching ---
  // 🔧 Fix: fetchStaff 只需要行一次
  useEffect(() => { fetchStaff(); }, []);

  // 🔧 Fix: date 範圍變動時 re-fetch
  useEffect(() => {
    fetchOrders();
  }, [filters.startDate, filters.endDate]);

  const fetchStaff = async () => {
    const { data } = await supabase.from('profiles').select('id, name');
    setStaffList(data || []);
  };

  const fetchOrders = async () => {
    setLoading(true);

    // 🔧 Fix: 三個 query 並行，payment/refund 加入日期範圍，FK 路徑修正
    const [svcRes, ptRes, rfRes] = await Promise.all([
      supabase.from('client_services').select('*, clients(name), treatments(name)')
        .gte('purchase_date', filters.startDate)
        .lte('purchase_date', filters.endDate),
      supabase.from('payment_transactions').select('*')
        .gte('transaction_date', filters.startDate)
        .lte('transaction_date', filters.endDate)
        .not('remarks', 'ilike', '%VOID%'),
      // 🔧 Fix: refunds FK 路徑 — refunded_by → staff, client_service_id → client_services
      supabase.from('refunds').select('*, client_services(*, clients(name), treatments(name))')
        .gte('refund_date', filters.startDate)
        .lte('refund_date', filters.endDate),
    ]);

    const services = svcRes.data || [];
    const payments = ptRes.data || [];
    const refunds = rfRes.data || [];

    // Manual join: staff names for settled_by + refunded_by
    const allStaffIds = new Set();
    payments.forEach(p => { if (p.settled_by) allStaffIds.add(p.settled_by); });
    refunds.forEach(r => { if (r.refunded_by) allStaffIds.add(r.refunded_by); });
    const staffMap = {};
    if (allStaffIds.size > 0) {
      const { data: sf } = await supabase.from('profiles').select('id,name').in('id', [...allStaffIds]);
      sf?.forEach(s => { staffMap[s.id] = s.name; });
    }

    // 整合訂單數據
    const formattedOrders = services.map(s => {
      const relatedPayments = payments.filter(p => p.client_id === s.client_id && p.treatment_id === s.treatment_id);
      const paidAmount = relatedPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const lastPaymentDate = relatedPayments.length > 0
        ? [...relatedPayments].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))[0].transaction_date
        : '-';
      const staffName = staffMap[relatedPayments[0]?.settled_by] || '—';

      return {
        ...s,
        type: 'order',
        paid_amount: paidAmount,
        last_payment_date: lastPaymentDate,
        staff_name: staffName,
        is_void: false
      };
    });

    // 加入退款行
    const refundRows = refunds.map(r => ({
      id: `ref_${r.id}`,
      type: 'refund',
      client_name: r.client_services?.clients?.name || '—',
      treatment_name: r.client_services?.treatments?.name || '—',
      amount: -(parseFloat(r.refund_amount) || 0),
      reason: r.reason || '',
      refund_date: r.refund_date,
      staff_name: staffMap[r.refunded_by] || '—',
      status: 'refunded'
    }));

    setOrders([...formattedOrders, ...refundRows]);
    setLoading(false);
  };

  // --- Logic & Filtering ---
  const filteredList = useMemo(() => {
    return orders.filter(item => {
      // 基本搜索篩選
      const matchSearch = item.type === 'order'
        ? item.clients?.name?.includes(filters.search)
        : item.client_name?.includes(filters.search);

      const matchStaff = filters.staffId === '' || item.staff_name === staffList.find(s => s.id === filters.staffId)?.name;

      if (!matchSearch || !matchStaff) return false;

      // Tab 篩選
      if (activeTab === 'pending') {
        const isPending = item.type === 'order' && (item.remaining_sessions > 0 || item.paid_amount < (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0)));
        if (!isPending) return false;

        // Chip 篩選 (緩存中)
        if (activeChip === 'debt') return item.remaining_sessions === 0 && item.paid_amount < (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0));
        if (activeChip === 'unused') return item.remaining_sessions > 0;
        if (activeChip === 'high_risk') {
          const daysDiff = (new Date() - new Date(item.purchase_date)) / (1000 * 60 * 60 * 24);
          return item.paid_amount < (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0)) && daysDiff > 60;
        }
      } else if (activeTab === 'completed') {
        const totalPrice = parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0);
        const isCompleted = item.type === 'order' && item.remaining_sessions === 0 && item.paid_amount >= totalPrice;
        if (!isCompleted) return false;

        // Chip 篩選 (已完成)
        const isThisMonth = new Date(item.purchase_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (activeChip === 'this_month') return isThisMonth;
        if (activeChip === 'history') return !isThisMonth;
      } else if (activeTab === 'refunded') {
        const isRefund = item.status === 'refunded' || item.type === 'refund';
        if (!isRefund) return false;

        // Chip 篩選 (已退款)
        const refundDate = item.type === 'refund' ? item.refund_date : item.purchase_date;
        const isThisMonth = new Date(refundDate) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (activeChip === 'this_month_ref') return isThisMonth;
        if (activeChip === 'history_ref') return !isThisMonth;
      }

      return true;
    });
  }, [orders, activeTab, activeChip, filters.search, filters.staffId, staffList]);

  // Stats for Tabs & Chips
  const stats = useMemo(() => {
    const totalPrice = (o) => parseFloat(o.total_price) || (parseFloat(o.unit_price) || 0) * (o.total_sessions || 0);
    const s = {
      all: orders.length,
      pending: orders.filter(o => o.type === 'order' && (o.remaining_sessions > 0 || o.paid_amount < totalPrice(o))).length,
      completed: orders.filter(o => o.type === 'order' && o.remaining_sessions === 0 && o.paid_amount >= totalPrice(o)).length,
      refunded: orders.filter(o => o.status === 'refunded' || o.type === 'refund').length,

      // Chips counts & amounts
      debtCount: orders.filter(o => o.type === 'order' && o.remaining_sessions === 0 && o.paid_amount < totalPrice(o)).length,
      debtSum: orders.filter(o => o.type === 'order' && o.remaining_sessions === 0 && o.paid_amount < totalPrice(o)).reduce((sum, o) => sum + (totalPrice(o) - o.paid_amount), 0),

      unusedCount: orders.filter(o => o.type === 'order' && o.remaining_sessions > 0).length,
      unusedSum: orders.filter(o => o.type === 'order' && o.remaining_sessions > 0).reduce((sum, o) => sum + totalPrice(o), 0),

      // High risk
      riskCount: orders.filter(o => {
        if (o.type !== 'order') return false;
        if (o.paid_amount >= totalPrice(o)) return false;
        const daysDiff = (new Date() - new Date(o.purchase_date)) / (1000 * 60 * 60 * 24);
        return daysDiff > 60;
      }).length,
      riskSum: orders.filter(o => {
        if (o.type !== 'order') return false;
        if (o.paid_amount >= totalPrice(o)) return false;
        const daysDiff = (new Date() - new Date(o.purchase_date)) / (1000 * 60 * 60 * 24);
        return daysDiff > 60;
      }).reduce((sum, o) => sum + (totalPrice(o) - o.paid_amount), 0),

      // Completed breakdown
      thisMonthCompCount: orders.filter(o => {
        if (o.type !== 'order') return false;
        const total = totalPrice(o);
        if (!(o.remaining_sessions === 0 && o.paid_amount >= total)) return false;
        return new Date(o.purchase_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }).length,
      historyCompCount: orders.filter(o => {
        if (o.type !== 'order') return false;
        const total = totalPrice(o);
        if (!(o.remaining_sessions === 0 && o.paid_amount >= total)) return false;
        return new Date(o.purchase_date) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }).length,

      // Refund breakdown
      thisMonthRefCount: orders.filter(o => {
        if (o.type !== 'refund') return false;
        return new Date(o.refund_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }).length,
      historyRefCount: orders.filter(o => {
        if (o.type !== 'refund') return false;
        return new Date(o.refund_date) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }).length,
    };
    return s;
  }, [orders]);

  const handleExport = () => exportSales(supabase);

  // 🔧 Fix: 用 flex-1 flex flex-col min-h-0 而非 h-screen + p-6（AppLayout 已經有 p-6）
  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* 2.1 頁面標題區 */}
      <header className="shrink-0 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          📋 訂單管理
        </h1>
        <Button
          variant="secondary"
          icon={DocumentArrowDownIcon}
          onClick={handleExport}
        >
          匯出 Excel
        </Button>
      </header>

      {/* 2.2 篩選區 & 2.6 Inline 統計 */}
      <div className="shrink-0 bg-surface rounded-2xl p-4 shadow-card flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-text-muted">日期</span>
          <input
            type="date"
            className="border-gray-200 rounded-xl text-sm focus:ring-primary focus:border-primary min-h-[44px] px-3 bg-bg"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
          />
          <span className="text-text-muted">～</span>
          <input
            type="date"
            className="border-gray-200 rounded-xl text-sm focus:ring-primary focus:border-primary min-h-[44px] px-3 bg-bg"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
          />
        </div>

        <div className="w-40">
          <Select
            value={filters.staffId}
            onChange={(e) => setFilters({...filters, staffId: e.target.value})}
          >
            <option value="">全部經手人</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>

        <div className="flex-1 relative min-w-[200px]">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput
            placeholder="搜尋客戶姓名..."
            className="pl-10"
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
          />
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm font-medium text-text-muted border-l pl-4">
          <span className="flex items-center gap-1"><Badge color="info">{stats.pending}</Badge> 緩存</span>
          <span className="flex items-center gap-1"><Badge color="success">{stats.completed}</Badge> 完成</span>
          <span className="flex items-center gap-1"><Badge color="gray">{stats.refunded}</Badge> 退款</span>
          <span className="text-text font-bold">共 {stats.all} 筆</span>
        </div>
      </div>

      {/* 2.3 訂單狀態切換 Tabs */}
      <div className="shrink-0 flex gap-2 border-b border-gray-100 pb-2">
        {[
          { id: 'all', label: '全部訂單', count: stats.all },
          { id: 'pending', label: '緩存中', count: stats.pending },
          { id: 'completed', label: '已完成', count: stats.completed },
          { id: 'refunded', label: '已退款', count: stats.refunded },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setActiveChip(null); }}
            className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-white hover:text-primary'}`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 2.4 快捷分類 Chips */}
      <div className="shrink-0 flex flex-wrap gap-2 min-h-[32px]">
        {activeTab === 'pending' && (
          <>
            <Chip active={activeChip === 'debt'} onClick={() => setActiveChip(activeChip === 'debt' ? null : 'debt')}>
              欠款未找 {stats.debtCount} 筆 · HK${stats.debtSum.toLocaleString()}
            </Chip>
            <Chip active={activeChip === 'unused'} onClick={() => setActiveChip(activeChip === 'unused' ? null : 'unused')}>
              未做套票 {stats.unusedCount} 筆 · HK${stats.unusedSum.toLocaleString()}
            </Chip>
            <Chip active={activeChip === 'high_risk'} onClick={() => setActiveChip(activeChip === 'high_risk' ? null : 'high_risk')} color="danger">
              高風險 &gt;60日 {stats.riskCount} 筆 · HK${stats.riskSum.toLocaleString()}
            </Chip>
          </>
        )}
        {activeTab === 'completed' && (
          <>
            <Chip active={activeChip === 'this_month'} onClick={() => setActiveChip(activeChip === 'this_month' ? null : 'this_month')}>
              本月完成 {stats.thisMonthCompCount} 筆
            </Chip>
            <Chip active={activeChip === 'history'} onClick={() => setActiveChip(activeChip === 'history' ? null : 'history')}>
              過往累積 {stats.historyCompCount} 筆
            </Chip>
          </>
        )}
        {activeTab === 'refunded' && (
          <>
            <Chip active={activeChip === 'this_month_ref'} onClick={() => setActiveChip(activeChip === 'this_month_ref' ? null : 'this_month_ref')}>
              本月退款 {stats.thisMonthRefCount} 筆
            </Chip>
            <Chip active={activeChip === 'history_ref'} onClick={() => setActiveChip(activeChip === 'history_ref' ? null : 'history_ref')}>
              過往退款 {stats.historyRefCount} 筆
            </Chip>
          </>
        )}
      </div>

      {/* 2.5 訂單列表 (表格) */}
      <div className="flex-1 bg-surface rounded-2xl shadow-card overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-bg z-0">
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">客戶</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">療程</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">已收 / 總額</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">剩餘次數</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">付款進度</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">購買日期</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">最後收錢</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">經手人</th>
                <th className="px-6 py-4 text-xs font-bold text-text-muted uppercase">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <Spinner size="xl" />
                  </td>
                </tr>
              ) : filteredList.length > 0 ? (
                filteredList.map((item) => (
                  <tr key={item.id} className={`hover:bg-primary-light/5 transition-colors ${item.type === 'refund' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {item.type === 'refund' && <NoSymbolIcon className="w-4 h-4 text-danger" />}
                        <span className="font-bold text-text">{item.clients?.name || item.client_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">{item.treatments?.name || item.treatment_name}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${item.type === 'refund' ? 'text-danger' : 'text-primary'}`}>
                        {item.type === 'refund'
                          ? `HK$${item.amount.toLocaleString()}`
                          : `HK$${item.paid_amount.toLocaleString()} / $${(parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0)).toLocaleString()}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.type === 'order' ? (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4 text-text-muted" />
                          {item.remaining_sessions} / {item.total_sessions} 次
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 min-w-[140px]">
                      {item.type === 'order' ? (
                        <div className="flex flex-col gap-1">
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${item.paid_amount >= (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0)) ? 'bg-success' : 'bg-primary'}`}
                              style={{ width: `${Math.min(100, (item.paid_amount / (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0))) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-text-muted">
                            {Math.round((item.paid_amount / (parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0) || 1)) * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-danger italic truncate block w-32">{item.reason}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {item.type === 'order' ? item.purchase_date : item.refund_date}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {item.type === 'order' ? item.last_payment_date : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm px-2 py-1 bg-gray-100 rounded-lg text-text-muted">
                        {item.staff_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge item={item} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-text-muted italic">
                    沒有符合條件的訂單記錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const Chip = ({ active, onClick, children, color = 'primary' }) => {
  const activeStyles = {
    primary: 'bg-primary text-white border-primary shadow-sm',
    danger: 'bg-danger text-white border-danger shadow-sm'
  };
  const inactiveStyles = 'bg-white text-text-muted border-gray-200 hover:border-primary hover:text-primary';

  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${active ? activeStyles[color] : inactiveStyles}`}
    >
      {children}
    </button>
  );
};

const StatusBadge = ({ item }) => {
  // 🔧 Fix: Tag 元件支援 rose, green, amber, gray
  if (item.type === 'refund' || item.status === 'refunded') {
    return <Tag color="gray">已退款</Tag>;
  }
  const totalPrice = parseFloat(item.total_price) || (parseFloat(item.unit_price) || 0) * (item.total_sessions || 0);
  if (item.remaining_sessions === 0 && item.paid_amount >= totalPrice) {
    return <Tag color="green">已完成</Tag>;
  }
  if (item.paid_amount < totalPrice && item.remaining_sessions === 0) {
    return <Tag color="amber">欠款未找</Tag>;
  }
  return <Tag color="rose">緩存中</Tag>;
};

export default OrderManagePage;
