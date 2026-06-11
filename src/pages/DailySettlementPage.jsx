/**
 * 收入紀錄頁面 v2 — 雙框架 + 篩選列 + 訂單列表 + 收款統計
 * 🟡 緩存中：未收足 / 未做完  🟢 確定收入：收足 + 做完
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Spinner } from 'flowbite-react';
import {
  BanknotesIcon, CreditCardIcon, ArrowsRightLeftIcon,
  MagnifyingGlassIcon, FunnelIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';

const PAYMENT_LABELS = {
  cash: '💵 現金',
  card: '💳 信用卡',
  transfer: '📱 轉賬',
  other: '📋 其他',
};

const PAYMENT_ICONS = {
  cash: '💵',
  card: '💳',
  transfer: '📱',
  other: '📋',
};

const SettlementPage = () => {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 7) + '-01';

  // 篩選狀態
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState(''); // ''=全部, 'buffer', 'confirmed', 'refunded'
  const [clientSearch, setClientSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);       // payment_transactions list
  const [bufferOrders, setBufferOrders] = useState([]); // 緩存 client_services
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  // 用來 filter 下方 list：點擊框架卡 → 設定 activeTab
  const [activeTab, setActiveTab] = useState(''); // ''=全部, 'buffer', 'confirmed'

  useEffect(() => { fetchAll(); }, [from, to]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. 所有 payment_transactions（含 JOIN）
      let ptQuery = supabase
        .from('payment_transactions')
        .select('*, clients(name), treatments(name), profiles!settled_by(name)')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false });

      if (methodFilter) ptQuery = ptQuery.eq('payment_method', methodFilter);

      // 2. 所有 client_services（含 JOIN）+ 計算已收總額
      //    用 RPC 或前端計算 — 呢度先拉 payment_transactions 再 group
      const [ptRes, csRes] = await Promise.all([
        ptQuery,
        supabase
          .from('client_services')
          .select('*, clients(name), treatments(name)')
          .order('purchase_date', { ascending: false }),
      ]);

      const allPayments = ptRes.data || [];
      const allServices = csRes.data || [];

      // 按 client_service 計算已收總額
      const paidByService = {}; // key: client_id:treatment_id → total_paid
      allPayments.forEach(p => {
        if (p.remarks?.includes('VOID')) return;
        const key = `${p.client_id}:${p.treatment_id}`;
        paidByService[key] = (paidByService[key] || 0) + parseFloat(p.amount || 0);
      });

      // 分類 client_services → 緩存 vs 確定
      const buffer = [];
      const confirmed = [];
      allServices.forEach(cs => {
        if (cs.status === 'refunded') return;
        const totalPrice = parseFloat(cs.unit_price || 0) * (cs.total_sessions || 0);
        const paid = paidByService[`${cs.client_id}:${cs.treatment_id}`] || 0;
        const isComplete = cs.remaining_sessions === 0 && paid >= totalPrice;
        const enriched = { ...cs, total_price: totalPrice, total_paid: paid };
        if (isComplete) {
          confirmed.push(enriched);
        } else {
          buffer.push(enriched);
        }
      });

      setPayments(allPayments);
      setBufferOrders(buffer);
      setConfirmedOrders(confirmed);
    } catch (e) {
      console.warn('Settlement fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // 前端篩選
  const filteredPayments = useMemo(() => {
    let list = payments;

    // 收款方式篩選（如果未 push 落 query，二次 filter）
    if (methodFilter) list = list.filter(p => p.payment_method === methodFilter);

    // 狀態篩選（activeTab 點擊框架卡；statusFilter 下拉）
    const activeStatus = statusFilter || activeTab;
    if (activeStatus === 'buffer') {
      // 緩存中：所屬 client_service 係緩存（remaining>0 OR paid<total）
      list = list.filter(p => {
        const cs = bufferOrders.find(
          b => b.client_id === p.client_id && b.treatment_id === p.treatment_id
        );
        return !!cs;
      });
    } else if (activeStatus === 'confirmed') {
      list = list.filter(p => {
        const cs = confirmedOrders.find(
          c => c.client_id === p.client_id && c.treatment_id === p.treatment_id
        );
        return !!cs;
      });
    } else if (activeStatus === 'refunded') {
      list = list.filter(p => p.remarks?.includes('REFUND'));
    }

    // 客戶搜尋
    if (clientSearch.trim()) {
      const kw = clientSearch.trim().toLowerCase();
      list = list.filter(p =>
        (p.clients?.name || '').toLowerCase().includes(kw) ||
        (p.clients?.phone || '').includes(kw)
      );
    }

    return list;
  }, [payments, methodFilter, statusFilter, activeTab, clientSearch, bufferOrders, confirmedOrders]);

  // 統計
  const stats = useMemo(() => {
    const byMethod = { cash: 0, card: 0, transfer: 0, other: 0 };
    let total = 0;
    let voidCount = 0;
    filteredPayments.forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      total += amt;
      byMethod[p.payment_method] = (byMethod[p.payment_method] || 0) + amt;
      if (p.remarks?.includes('VOID')) voidCount++;
    });
    return { total, byMethod, voidCount, count: filteredPayments.length };
  }, [filteredPayments]);

  // 緩存統計
  const bufferStats = useMemo(() => {
    const totalPending = bufferOrders.reduce((sum, o) => sum + (o.total_price - o.total_paid), 0);
    return { count: bufferOrders.length, pending: totalPending };
  }, [bufferOrders]);

  const confirmedStats = useMemo(() => {
    const totalEarned = confirmedOrders.reduce((sum, o) => sum + o.total_paid, 0);
    return { count: confirmedOrders.length, earned: totalEarned };
  }, [confirmedOrders]);

  // lookup: payment → 其所屬 client_service 進度
  const getProgress = (p) => {
    const all = [...bufferOrders, ...confirmedOrders];
    const cs = all.find(
      c => c.client_id === p.client_id && c.treatment_id === p.treatment_id
    );
    if (!cs) return { paid: parseFloat(p.amount) || 0, total: 0, pct: 100, isBuffer: false };
    const paid = cs.total_paid || 0;
    const total = cs.total_price || 0;
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    const isBuffer = bufferOrders.some(
      b => b.client_id === p.client_id && b.treatment_id === p.treatment_id
    );
    return { paid, total, pct, isBuffer };
  };

  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1);

  // --- Render helpers ---
  const progressBar = (pct, isBuffer) => (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isBuffer ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${isBuffer ? 'text-warning' : 'text-success'}`}>
        {pct}%
      </span>
    </div>
  );

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4">
      {/* Header */}
      <header className="shrink-0 bg-surface p-5 rounded-2xl shadow-card">
        <h1 className="text-2xl font-bold text-text">💰 收入紀錄</h1>
        <p className="text-text-muted text-sm mt-1">訂單記錄列表 — 一單一記錄，分期顯示進度</p>
      </header>

      {/* ===== 篩選列 ===== */}
      <div className="shrink-0 bg-surface p-4 rounded-2xl shadow-card flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">開始日期</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-xl min-h-[44px] px-3 text-sm bg-bg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">結束日期</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-xl min-h-[44px] px-3 text-sm bg-bg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">狀態</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setActiveTab(''); }}
            className="border border-gray-200 rounded-xl min-h-[44px] px-3 text-sm bg-bg min-w-[110px]">
            <option value="">全部</option>
            <option value="buffer">🟡 緩存中</option>
            <option value="confirmed">🟢 確定收入</option>
            <option value="refunded">↩️ 已退款</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-text-muted mb-1">客戶搜尋</label>
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="text" placeholder="姓名 或 電話..."
              value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl min-h-[44px] pl-9 pr-3 text-sm bg-bg" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">收款方式</label>
          <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
            className="border border-gray-200 rounded-xl min-h-[44px] px-3 text-sm bg-bg min-w-[120px]">
            <option value="">全部</option>
            <option value="cash">💵 現金</option>
            <option value="card">💳 信用卡</option>
            <option value="transfer">📱 轉賬</option>
            <option value="other">📋 其他</option>
          </select>
        </div>
        <div className="text-xs text-text-muted ml-auto self-center pt-5">
          {from} ~ {to} · {days} 天 · {filteredPayments.length} 筆
        </div>
      </div>

      {/* ===== 雙框架卡 ===== */}
      <div className="shrink-0 grid grid-cols-2 gap-4">
        {/* 🟡 緩存中 */}
        <button
          onClick={() => { setActiveTab(activeTab === 'buffer' ? '' : 'buffer'); setStatusFilter(''); }}
          className={`text-left bg-surface p-5 rounded-2xl shadow-card border-2 transition-all
            ${activeTab === 'buffer' ? 'border-amber-400 shadow-lg' : 'border-amber-200 hover:border-amber-300'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🟡</span>
            <h3 className="font-bold text-text">緩存中</h3>
            <span className="text-xs text-text-muted ml-auto">未收足 / 未做完</span>
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-3xl font-black text-warning">{bufferStats.count}</span>
              <span className="text-sm text-text-muted ml-1">筆訂單</span>
            </div>
            <div>
              <span className="text-sm text-text-muted">待收金額</span>
              <span className="text-xl font-bold text-warning ml-2">
                HK${bufferStats.pending.toLocaleString()}
              </span>
            </div>
          </div>
        </button>

        {/* 🟢 確定收入 */}
        <button
          onClick={() => { setActiveTab(activeTab === 'confirmed' ? '' : 'confirmed'); setStatusFilter(''); }}
          className={`text-left bg-surface p-5 rounded-2xl shadow-card border-2 transition-all
            ${activeTab === 'confirmed' ? 'border-emerald-400 shadow-lg' : 'border-emerald-200 hover:border-emerald-300'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🟢</span>
            <h3 className="font-bold text-text">確定收入</h3>
            <span className="text-xs text-text-muted ml-auto">已收足 + 已做完</span>
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-3xl font-black text-success">{confirmedStats.count}</span>
              <span className="text-sm text-text-muted ml-1">筆訂單</span>
            </div>
            <div>
              <span className="text-sm text-text-muted">已收金額</span>
              <span className="text-xl font-bold text-success ml-2">
                HK${confirmedStats.earned.toLocaleString()}
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* ===== 訂單記錄列表 ===== */}
      <div className="flex-1 min-h-0 overflow-auto bg-surface rounded-2xl shadow-card">
        <div className="sticky top-0 z-0 bg-surface p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-text flex items-center gap-2">
            <FunnelIcon className="w-4 h-4" />
            {activeTab === 'buffer' ? '🟡 緩存中訂單' : activeTab === 'confirmed' ? '🟢 確定收入訂單' : '📋 訂單記錄'}
          </h3>
          <span className="text-xs text-text-muted">{filteredPayments.length} 筆</span>
        </div>

        {filteredPayments.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-[57px] z-0">
              <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                <th className="px-5 py-3 font-bold">日期</th>
                <th className="px-5 py-3 font-bold">客戶</th>
                <th className="px-5 py-3 font-bold">療程</th>
                <th className="px-5 py-3 font-bold">已收 / 總額</th>
                <th className="px-5 py-3 font-bold">完成度</th>
                <th className="px-5 py-3 font-bold">收款方式</th>
                <th className="px-5 py-3 font-bold w-8">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.map(tx => {
                const { paid, total, pct, isBuffer } = getProgress(tx);
                const isVoid = tx.remarks?.includes('VOID');
                return (
                  <tr key={tx.id} className={`hover:bg-bg/50 transition-colors ${isVoid ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 whitespace-nowrap text-text-muted">
                      {tx.transaction_date?.slice(5)}
                    </td>
                    <td className="px-5 py-3 font-bold">{tx.clients?.name || '—'}</td>
                    <td className="px-5 py-3">{tx.treatments?.name || '—'}</td>
                    <td className="px-5 py-3 font-mono text-sm">
                      <span className={isBuffer ? 'text-warning font-bold' : 'text-success font-bold'}>
                        HK${paid.toLocaleString()}
                      </span>
                      <span className="text-text-muted">/{total.toLocaleString()}</span>
                    </td>
                    <td className="px-5 py-3">{progressBar(pct, isBuffer)}</td>
                    <td className="px-5 py-3">{PAYMENT_LABELS[tx.payment_method] || tx.payment_method}</td>
                    <td className="px-5 py-3 text-center text-lg">
                      {isVoid ? '↩️' : isBuffer ? '🟡' : '🟢'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-center py-16 text-text-muted">此期間暫無交易紀錄</p>
        )}
      </div>

      {/* ===== 底部收款方式統計 ===== */}
      <div className="shrink-0 bg-surface p-4 rounded-2xl shadow-card">
        <h4 className="text-sm font-bold text-text-muted mb-3">📊 收款方式統計（篩選範圍內）</h4>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2 bg-bg px-4 py-2 rounded-xl min-w-[140px]">
              <span className="text-lg">{PAYMENT_ICONS[key]}</span>
              <span className="text-sm text-text-muted">{label.replace(/[💵💳📱📋]\s*/, '')}</span>
              <span className="font-bold text-text ml-auto">
                HK${(stats.byMethod[key] || 0).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl min-w-[140px] ml-auto">
            <span className="text-sm text-text-muted">合計</span>
            <span className="font-black text-lg text-primary">
              HK${stats.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementPage;
