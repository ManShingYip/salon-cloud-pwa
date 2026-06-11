/**
 * 收入紀錄頁面 v3 — 三 Tab-Card + 日曆式日期 + 子拆解 + 退款
 * 🟡 緩存(需跟進) · 🟢 確定(已落袋) · 🔴 退款(異常)
 *
 * 店長每日返工一 click 就知邊個爭錢、邊張單就快爛尾、今個月做咗幾多生意。
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Spinner } from 'flowbite-react';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { exportSales } from '@/utils/exportExcel';

// ─── 常數 ───────────────────────────────────────────
const TODAY = new Date().toISOString().split('T')[0];
const FIRST_OF_MONTH = TODAY.slice(0, 7) + '-01';
const MS_PER_DAY = 86400000;

const fmtMoney = (n) => `HK$${(n || 0).toLocaleString()}`;
const fmtShortDate = (d) => d?.slice(5); // "2026-06-10" → "06-10"

// ─── 組件 ───────────────────────────────────────────
const SettlementPage = () => {
  // 日期
  const [from, setFrom] = useState(FIRST_OF_MONTH);
  const [to, setTo] = useState(TODAY);

  // 篩選
  const [staffFilter, setStaffFilter] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  // Tab
  const [activeTab, setActiveTab] = useState('buffer'); // 'buffer' | 'confirmed' | 'refund'
  // 子拆解 filter
  const [bufferSub, setBufferSub] = useState('all');    // 'all' | 'debt' | 'unserved' | 'risk'
  const [confirmedSub, setConfirmedSub] = useState('all'); // 'all' | 'this_month' | 'past'
  const [refundSub, setRefundSub] = useState('all');     // 'all' | 'this_month' | 'past'

  // Data
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allRefunds, setAllRefunds] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // ─── Data Fetching ────────────────────────────────
  useEffect(() => { fetchData(); }, [from, to]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [svcRes, ptRes, rfRes, staffRes] = await Promise.all([
        supabase.from('client_services').select('*, clients(name), treatments(name)').order('purchase_date', { ascending: false }),
        supabase.from('payment_transactions')
          .select('*, clients(name), treatments(name), profiles!settled_by(name)')
          .gte('transaction_date', from).lte('transaction_date', to)
          .order('transaction_date', { ascending: false }),
        supabase.from('refunds')
          .select('*, client_services!inner(*, clients!inner(name), treatments!inner(name)), profiles!refunded_by(name)')
          .gte('refund_date', from).lte('refund_date', to)
          .order('refund_date', { ascending: false }),
        supabase.from('profiles').select('id, name').eq('is_active', true),
      ]);
      setAllServices(svcRes.data || []);
      setAllPayments(ptRes.data || []);
      setAllRefunds(rfRes.data || []);
      setStaffList(staffRes.data || []);
    } catch (e) {
      console.warn('Settlement fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ─── 運算層 ────────────────────────────────────────
  // paidByService map: "client_id:treatment_id" → total_paid
  const paidByService = useMemo(() => {
    const map = {};
    allPayments.forEach(p => {
      if (p.remarks?.includes('VOID')) return;
      const key = `${p.client_id}:${p.treatment_id}`;
      map[key] = (map[key] || 0) + parseFloat(p.amount || 0);
    });
    return map;
  }, [allPayments]);

  // 分類 client_services → buffer / confirmed
  const { bufferOrders, confirmedOrders } = useMemo(() => {
    const buf = [], conf = [];
    allServices.forEach(cs => {
      if (cs.status === 'refunded') return;
      const totalPrice = parseFloat(cs.total_price) || (parseFloat(cs.unit_price) || 0) * (cs.total_sessions || 0);
      const paid = paidByService[`${cs.client_id}:${cs.treatment_id}`] || 0;
      const enriched = { ...cs, total_price: totalPrice, total_paid: paid };
      if (cs.remaining_sessions === 0 && paid >= totalPrice) {
        conf.push(enriched);
      } else {
        buf.push(enriched);
      }
    });
    return { bufferOrders: buf, confirmedOrders: conf };
  }, [allServices, paidByService]);

  // 退款列表（normalize 到 row format）
  const refundRows = useMemo(() => allRefunds.map(r => ({
    id: r.id,
    type: 'refund',
    clientName: r.client_services?.clients?.name || '—',
    treatmentName: r.client_services?.treatments?.name || '—',
    paid: parseFloat(r.refund_amount) || 0,
    total: 0,
    pct: 0,
    isBuffer: false,
    isRefund: true,
    date: r.refund_date,
    dateLabel: '退款',
    staffName: r.profiles?.name || '—',
    reason: r.reason || '',
  })), [allRefunds]);

  // ─── 子拆解統計 ────────────────────────────────────
  const bufferBreakdown = useMemo(() => {
    const debt = bufferOrders.filter(o => o.remaining_sessions === 0 && o.total_paid < o.total_price);
    const unserved = bufferOrders.filter(o => o.remaining_sessions > 0);
    const today = new Date();
    const risk = bufferOrders.filter(o => {
      const days = Math.floor((today - new Date(o.purchase_date)) / MS_PER_DAY);
      return days > 60;
    });
    return {
      debt: { count: debt.length, amount: debt.reduce((s, o) => s + (o.total_price - o.total_paid), 0) },
      unserved: { count: unserved.length, amount: unserved.reduce((s, o) => s + (o.total_price - o.total_paid), 0) },
      risk: { count: risk.length, amount: risk.reduce((s, o) => s + (o.total_price - o.total_paid), 0) },
    };
  }, [bufferOrders]);

  const confirmedBreakdown = useMemo(() => {
    const thisMonthStart = TODAY.slice(0, 7) + '-01';
    const thisMonthOrders = confirmedOrders.filter(o => {
      // 搵最後一筆 payment 嘅日期
      const lastPmt = allPayments
        .filter(p => p.client_id === o.client_id && p.treatment_id === o.treatment_id && !p.remarks?.includes('VOID'))
        .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))[0];
      return lastPmt && lastPmt.transaction_date >= thisMonthStart;
    });
    const pastOrders = confirmedOrders.filter(o => !thisMonthOrders.includes(o));
    return {
      thisMonth: { count: thisMonthOrders.length, amount: thisMonthOrders.reduce((s, o) => s + o.total_paid, 0) },
      past: { count: pastOrders.length, amount: pastOrders.reduce((s, o) => s + o.total_paid, 0) },
    };
  }, [confirmedOrders, allPayments]);

  const refundBreakdown = useMemo(() => {
    const thisMonthStart = TODAY.slice(0, 7) + '-01';
    const thisMonth = allRefunds.filter(r => r.refund_date >= thisMonthStart);
    const past = allRefunds.filter(r => r.refund_date < thisMonthStart);
    return {
      thisMonth: { count: thisMonth.length, amount: thisMonth.reduce((s, r) => s + (parseFloat(r.refund_amount) || 0), 0) },
      past: { count: past.length, amount: past.reduce((s, r) => s + (parseFloat(r.refund_amount) || 0), 0) },
    };
  }, [allRefunds]);

  // ─── 組裝 List Rows ───────────────────────────────
  const allRows = useMemo(() => {
    // Payment rows
    const paymentRows = allPayments.map(p => {
      const totalPrice = parseFloat(p.total_price) || (parseFloat(p.unit_price) || 0) * ((p.total_sessions) || 0);
      const paid = parseFloat(p.amount) || 0;
      const cs = allServices.find(s => s.client_id === p.client_id && s.treatment_id === p.treatment_id);
      const csTotal = cs ? (parseFloat(cs.total_price) || (parseFloat(cs.unit_price) || 0) * (cs.total_sessions || 0)) : totalPrice;
      const csPaid = cs ? (paidByService[`${cs.client_id}:${cs.treatment_id}`] || 0) : paid;
      const isBuffer = cs
        ? !(cs.remaining_sessions === 0 && csPaid >= csTotal)
        : true;
      const pct = csTotal > 0 ? Math.round((csPaid / csTotal) * 100) : 0;
      const isVoid = p.remarks?.includes('VOID');
      return {
        id: p.id,
        type: isVoid ? 'void' : 'payment',
        clientName: p.clients?.name || '—',
        treatmentName: p.treatments?.name || '—',
        paid: csPaid,
        total: csTotal,
        pct,
        isBuffer,
        isRefund: false,
        date: p.transaction_date,
        dateLabel: isVoid ? '已退回' : '收錢',
        staffName: p.profiles?.name || '—',
        reason: '',
      };
    });
    return [...paymentRows, ...refundRows];
  }, [allPayments, refundRows, allServices, paidByService]);

  // ─── Tab 過濾 ──────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Tab filter
    if (activeTab === 'buffer') {
      rows = rows.filter(r => r.type === 'payment' && r.isBuffer);
    } else if (activeTab === 'confirmed') {
      rows = rows.filter(r => r.type === 'payment' && !r.isBuffer);
    } else if (activeTab === 'refund') {
      rows = rows.filter(r => r.type === 'refund');
    }

    // 子拆解 filter
    if (activeTab === 'buffer') {
      const now = new Date();
      if (bufferSub === 'debt') {
        rows = rows.filter(r => {
          const cs = bufferOrders.find(o => o.client_id && o.treatment_id && r.type === 'payment');
          // match by client+ treatment
          return bufferOrders.some(o =>
            o.remaining_sessions === 0 && o.total_paid < o.total_price
            && r.clientName === o.clients?.name && r.treatmentName === o.treatments?.name
          );
        });
      } else if (bufferSub === 'unserved') {
        rows = rows.filter(r =>
          bufferOrders.some(o =>
            o.remaining_sessions > 0
            && r.clientName === o.clients?.name && r.treatmentName === o.treatments?.name
          )
        );
      } else if (bufferSub === 'risk') {
        rows = rows.filter(r =>
          bufferOrders.some(o => {
            const days = Math.floor((now - new Date(o.purchase_date)) / MS_PER_DAY);
            return days > 60 && r.clientName === o.clients?.name && r.treatmentName === o.treatments?.name;
          })
        );
      }
    }
    if (activeTab === 'confirmed') {
      const thisMonthStart = TODAY.slice(0, 7) + '-01';
      if (confirmedSub === 'this_month') {
        rows = rows.filter(r => r.date >= thisMonthStart);
      } else if (confirmedSub === 'past') {
        rows = rows.filter(r => r.date < thisMonthStart);
      }
    }
    if (activeTab === 'refund') {
      const thisMonthStart = TODAY.slice(0, 7) + '-01';
      if (refundSub === 'this_month') {
        rows = rows.filter(r => r.date >= thisMonthStart);
      } else if (refundSub === 'past') {
        rows = rows.filter(r => r.date < thisMonthStart);
      }
    }

    // 員工篩選
    if (staffFilter) {
      rows = rows.filter(r => r.staffName === staffFilter);
    }

    // 客戶搜尋
    if (clientSearch.trim()) {
      const kw = clientSearch.trim().toLowerCase();
      rows = rows.filter(r => (r.clientName || '').toLowerCase().includes(kw));
    }

    return rows;
  }, [allRows, activeTab, bufferSub, confirmedSub, refundSub, staffFilter, clientSearch, bufferOrders]);

  // ─── Tab 統計 ──────────────────────────────────────
  const bufferStats = useMemo(() => ({
    count: bufferOrders.length,
    pending: bufferOrders.reduce((s, o) => s + Math.max(0, o.total_price - o.total_paid), 0),
  }), [bufferOrders]);

  const confirmedStats = useMemo(() => ({
    count: confirmedOrders.length,
    earned: confirmedOrders.reduce((s, o) => s + o.total_paid, 0),
  }), [confirmedOrders]);

  const refundStats = useMemo(() => ({
    count: allRefunds.length,
    amount: allRefunds.reduce((s, r) => s + (parseFloat(r.refund_amount) || 0), 0),
  }), [allRefunds]);

  // ─── 工具函數 ──────────────────────────────────────
  const progressBar = (pct, isBuffer) => (
    <div className="flex items-center gap-2 min-w-[130px]">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isBuffer ? 'bg-amber-400' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-10 text-right tabular-nums ${isBuffer ? 'text-amber-600' : 'text-emerald-600'}`}>
        {pct}%
      </span>
    </div>
  );

  const statusBadge = (row) => {
    if (row.type === 'refund') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />退款</span>;
    }
    if (row.type === 'void') {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />已退回</span>;
    }
    if (row.isBuffer) {
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />緩存</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />完成</span>;
  };

  // ─── Render ────────────────────────────────────────
  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / MS_PER_DAY) + 1);
  const switchTab = (tab) => {
    setActiveTab(tab);
    // reset sub-filters
    setBufferSub('all');
    setConfirmedSub('all');
    setRefundSub('all');
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3">
      {/* ═══ Header ═══ */}
      <header className="shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">💰 收入紀錄</h1>
          <p className="text-text-muted text-xs mt-0.5">訂單交易列表 · 點擊分類快速篩選</p>
        </div>
        <button
          onClick={() => exportSales(supabase)}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-gray-200 text-text rounded-xl text-sm font-bold hover:bg-bg transition-colors shadow-sm"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          匯出 Excel
        </button>
      </header>

      {/* ═══ 全局篩選列 ═══ */}
      <div className="shrink-0 bg-surface rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        {/* 日期 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-muted font-bold text-xs">📅 日期</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px]" />
          <span className="text-gray-400 text-xs">~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px]" />
          <span className="text-xs text-text-muted ml-1">({days} 天)</span>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* 客戶搜尋 */}
        <div className="flex items-center gap-2 text-sm flex-1 min-w-[160px]">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-muted shrink-0" />
          <input type="text" placeholder="搜尋客戶姓名..."
            value={clientSearch} onChange={e => setClientSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px] outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* 員工 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-muted font-bold text-xs">👤 經手人</span>
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px] min-w-[100px]">
            <option value="">全部</option>
            {staffList.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* 結果筆數 */}
        <span className="text-xs text-text-muted ml-auto">{filteredRows.length} 筆</span>
      </div>

      {/* ═══ 三 Tab-Card ═══ */}
      <div className="shrink-0 grid grid-cols-3 gap-3">
        {/* 🟡 緩存中 */}
        <TabCard
          emoji="🟡"
          label="緩存中"
          subtitle="需跟進"
          count={bufferStats.count}
          unit="筆訂單"
          amount={fmtMoney(bufferStats.pending)}
          amountLabel="待收"
          color="amber"
          isActive={activeTab === 'buffer'}
          onClick={() => switchTab('buffer')}
        />
        {/* 🟢 確定收入 */}
        <TabCard
          emoji="🟢"
          label="確定收入"
          subtitle="已落袋"
          count={confirmedStats.count}
          unit="筆訂單"
          amount={fmtMoney(confirmedStats.earned)}
          amountLabel="實收"
          color="emerald"
          isActive={activeTab === 'confirmed'}
          onClick={() => switchTab('confirmed')}
        />
        {/* 🔴 退款紀錄 */}
        <TabCard
          emoji="🔴"
          label="退款紀錄"
          subtitle="異常"
          count={refundStats.count}
          unit="筆退款"
          amount={fmtMoney(refundStats.amount)}
          amountLabel="流失"
          color="red"
          isActive={activeTab === 'refund'}
          onClick={() => switchTab('refund')}
        />
      </div>

      {/* ═══ 子拆解行 ═══ */}
      <div className="shrink-0">
        {activeTab === 'buffer' && (
          <SubFilterBar color="amber">
            <SubChip label="全部" count={bufferStats.count} isActive={bufferSub === 'all'} onClick={() => setBufferSub('all')} />
            <SubChip label="欠款未找數" count={bufferBreakdown.debt.count} extra={fmtMoney(bufferBreakdown.debt.amount)} isActive={bufferSub === 'debt'} onClick={() => setBufferSub('debt')} emphasize />
            <SubChip label="未做完套票" count={bufferBreakdown.unserved.count} extra={fmtMoney(bufferBreakdown.unserved.amount)} isActive={bufferSub === 'unserved'} onClick={() => setBufferSub('unserved')} />
            <SubChip label={`高風險 >${60}日`} count={bufferBreakdown.risk.count} extra={fmtMoney(bufferBreakdown.risk.amount)} isActive={bufferSub === 'risk'} onClick={() => setBufferSub('risk')} warn />
          </SubFilterBar>
        )}
        {activeTab === 'confirmed' && (
          <SubFilterBar color="emerald">
            <SubChip label="全部" count={confirmedStats.count} isActive={confirmedSub === 'all'} onClick={() => setConfirmedSub('all')} />
            <SubChip label="本月完成" count={confirmedBreakdown.thisMonth.count} extra={fmtMoney(confirmedBreakdown.thisMonth.amount)} isActive={confirmedSub === 'this_month'} onClick={() => setConfirmedSub('this_month')} emphasize />
            <SubChip label="過往累積" count={confirmedBreakdown.past.count} extra={fmtMoney(confirmedBreakdown.past.amount)} isActive={confirmedSub === 'past'} onClick={() => setConfirmedSub('past')} />
          </SubFilterBar>
        )}
        {activeTab === 'refund' && (
          <SubFilterBar color="red">
            <SubChip label="全部" count={refundStats.count} isActive={refundSub === 'all'} onClick={() => setRefundSub('all')} />
            <SubChip label="本月退款" count={refundBreakdown.thisMonth.count} extra={fmtMoney(refundBreakdown.thisMonth.amount)} isActive={refundSub === 'this_month'} onClick={() => setRefundSub('this_month')} emphasize />
            <SubChip label="過往退款" count={refundBreakdown.past.count} extra={fmtMoney(refundBreakdown.past.amount)} isActive={refundSub === 'past'} onClick={() => setRefundSub('past')} />
          </SubFilterBar>
        )}
      </div>

      {/* ═══ 訂單明細表格 ═══ */}
      <div className="flex-1 min-h-0 overflow-auto bg-surface rounded-xl border border-gray-200 shadow-sm flex flex-col">
        {/* 表格標題 */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0 sticky top-0 z-0">
          <h3 className="font-bold text-text text-sm">
            {activeTab === 'buffer' ? '🟡 緩存訂單' : activeTab === 'confirmed' ? '🟢 確定收入' : '🔴 退款紀錄'}
          </h3>
          <span className="text-xs text-text-muted">共 {filteredRows.length} 筆</span>
        </div>

        {/* 表格 */}
        <div className="flex-1 overflow-auto">
          {filteredRows.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-0">
                <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                  <th className="px-4 py-3 font-bold">客戶</th>
                  <th className="px-4 py-3 font-bold">療程</th>
                  <th className="px-4 py-3 font-bold">已收 / 總額</th>
                  <th className="px-4 py-3 font-bold w-48">進度</th>
                  <th className="px-4 py-3 font-bold">最後異動日</th>
                  <th className="px-4 py-3 font-bold">經手人</th>
                  <th className="px-4 py-3 font-bold">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRows.map(row => (
                  <tr key={row.id} className={`hover:bg-gray-50/70 transition-colors ${row.type === 'void' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3.5 font-bold">{row.clientName}</td>
                    <td className="px-4 py-3.5">{row.treatmentName}</td>
                    <td className="px-4 py-3.5 font-mono text-sm">
                      <span className={`font-bold ${row.isRefund ? 'text-danger' : row.isBuffer ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {fmtMoney(row.isRefund ? row.paid : row.paid)}
                      </span>
                      {!row.isRefund && (
                        <span className="text-gray-400">/{fmtMoney(row.total)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.isRefund ? (
                        <span className="text-xs text-red-500">—</span>
                      ) : (
                        progressBar(row.pct, row.isBuffer)
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-gray-700">{fmtShortDate(row.date)}</span>
                      <span className="text-xs text-text-muted ml-1.5">({row.dateLabel})</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{row.staffName}</td>
                    <td className="px-4 py-3.5">{statusBadge(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center py-20 text-text-muted">此篩選條件下暫無紀錄</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 子組件：Tab 卡片 ──────────────────────────────
const COLORS = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', borderActive: 'border-amber-400', dot: 'bg-amber-400', text: 'text-amber-900', sub: 'text-amber-700', ring: 'ring-amber-300/50', shadow: 'shadow-amber-100/50' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', borderActive: 'border-emerald-400', dot: 'bg-emerald-500', text: 'text-emerald-900', sub: 'text-emerald-700', ring: 'ring-emerald-300/50', shadow: 'shadow-emerald-100/50' },
  red: { bg: 'bg-red-50', border: 'border-red-200', borderActive: 'border-red-400', dot: 'bg-red-500', text: 'text-red-900', sub: 'text-red-700', ring: 'ring-red-300/50', shadow: 'shadow-red-100/50' },
};

const TabCard = ({ emoji, label, subtitle, count, unit, amount, amountLabel, color, isActive, onClick }) => {
  const c = COLORS[color];
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-xl p-4 border-2 transition-all overflow-hidden
        ${c.bg} ${isActive ? `${c.borderActive} shadow-md ${c.shadow} ring-1 ${c.ring}` : `${c.border} hover:border-${color === 'amber' ? 'amber' : color === 'emerald' ? 'emerald' : 'red'}-300 shadow-sm`}`}
    >
      {/* Decorative blur */}
      <div className={`absolute -right-3 -top-3 w-16 h-16 rounded-full blur-xl opacity-30 ${color === 'amber' ? 'bg-amber-300' : color === 'emerald' ? 'bg-emerald-300' : 'bg-red-300'}`} />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-lg">{emoji}</span>
          <span className={`font-bold text-sm ${c.text}`}>{label}</span>
          <span className={`text-[11px] ${c.sub} opacity-70`}>{subtitle}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className={`text-2xl font-black ${c.text}`}>{count}</span>
          <span className="text-xs text-gray-500">{unit}</span>
          <span className={`text-sm font-bold ${c.sub} ml-auto`}>
            {amountLabel} {amount}
          </span>
        </div>
      </div>
    </button>
  );
};

// ─── 子組件：子拆解行 ──────────────────────────────
const SubFilterBar = ({ color, children }) => {
  const bgMap = { amber: 'bg-amber-50/60', emerald: 'bg-emerald-50/60', red: 'bg-red-50/60' };
  const borderMap = { amber: 'border-amber-100', emerald: 'border-emerald-100', red: 'border-red-100' };
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${bgMap[color]} ${borderMap[color]} text-sm`}>
      <span className="text-xs font-bold text-gray-500">🔍 篩選：</span>
      {children}
    </div>
  );
};

const SubChip = ({ label, count, extra, isActive, onClick, emphasize, warn }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
        ${isActive
          ? 'bg-white shadow-sm text-gray-900 ring-1 ring-gray-200'
          : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}
        ${warn ? 'hover:text-red-600' : ''}
      `}
    >
      {label}
      <span className={`${isActive ? 'text-gray-400' : 'text-gray-400'}`}>{count}</span>
      {extra && (
        <span className={`ml-1 ${emphasize ? (warn ? 'text-red-500' : 'text-amber-600') : 'text-gray-400'}`}>
          {extra}
        </span>
      )}
    </button>
  );
};

export default SettlementPage;
