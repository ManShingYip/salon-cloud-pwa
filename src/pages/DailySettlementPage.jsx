/**
 * 收入紀錄 v3.1 — 一個大 List + 篩選 + 狀態 Tabs
 * 店長管理工具：一入嚟就睇到全部訂單，click tab 即 filter，唔分區
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Spinner } from 'flowbite-react';
import { MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { exportSales } from '@/utils/exportExcel';

const TODAY = new Date().toISOString().split('T')[0];
const FIRST_OF_MONTH = TODAY.slice(0, 7) + '-01';

const MS_PER_DAY = 86400000;
const fmtMoney = (n) => `HK$${(n || 0).toLocaleString()}`;

const SettlementPage = () => {
  const [from, setFrom] = useState(FIRST_OF_MONTH);
  const [to, setTo] = useState(TODAY);
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'buffer' | 'confirmed' | 'refund'
  const [staffFilter, setStaffFilter] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allRefunds, setAllRefunds] = useState([]);
  const [staffList, setStaffList] = useState([]);

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
          .select('*, client_services(*, clients(name), treatments(name)), profiles!refunded_by(name)')
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

  // paidByService
  const paidByService = useMemo(() => {
    const map = {};
    allPayments.forEach(p => {
      if (p.remarks?.includes('VOID')) return;
      const k = `${p.client_id}:${p.treatment_id}`;
      map[k] = (map[k] || 0) + parseFloat(p.amount || 0);
    });
    return map;
  }, [allPayments]);

  // ─── 組裝全部 row ─────────────────────────────────
  const allRows = useMemo(() => {
    // Payment rows
    const pRows = allPayments.map(p => {
      const cs = allServices.find(s => s.client_id === p.client_id && s.treatment_id === p.treatment_id);
      const csTotal = cs
        ? (parseFloat(cs.total_price) || (parseFloat(cs.unit_price) || 0) * (cs.total_sessions || 0))
        : 0;
      const csPaid = cs ? (paidByService[`${cs.client_id}:${cs.treatment_id}`] || 0) : parseFloat(p.amount || 0);
      const isBuffer = cs ? !(cs.remaining_sessions === 0 && csPaid >= csTotal) : false;
      const pct = csTotal > 0 ? Math.round((csPaid / csTotal) * 100) : 0;
      const isVoid = p.remarks?.includes('VOID');
      return {
        id: p.id,
        type: isVoid ? 'void' : 'payment',
        status: isVoid ? 'void' : isBuffer ? 'buffer' : 'confirmed',
        clientName: p.clients?.name || '—',
        treatmentName: p.treatments?.name || '—',
        paid: csPaid,
        total: csTotal,
        pct,
        sessionsTotal: cs?.total_sessions || 0,
        sessionsRemaining: cs?.remaining_sessions || 0,
        date: p.transaction_date,
        dateLabel: isVoid ? '已退回' : '收錢',
        staffName: p.profiles?.name || '—',
        reason: '',
      };
    });
    // Refund rows
    const rRows = allRefunds.map(r => ({
      id: r.id,
      type: 'refund',
      status: 'refund',
      clientName: r.client_services?.clients?.name || '—',
      treatmentName: r.client_services?.treatments?.name || '—',
      paid: parseFloat(r.refund_amount) || 0,
      total: 0,
      pct: 0,
      sessionsTotal: 0,
      sessionsRemaining: 0,
      date: r.refund_date,
      dateLabel: '退款',
      staffName: r.profiles?.name || '—',
      reason: r.reason || '',
    }));
    return [...pRows, ...rRows].sort((a, b) => b.date?.localeCompare(a.date));
  }, [allPayments, allRefunds, allServices, paidByService]);

  // ─── 篩選 ─────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Status tab
    if (statusTab === 'buffer')   rows = rows.filter(r => r.status === 'buffer');
    if (statusTab === 'confirmed') rows = rows.filter(r => r.status === 'confirmed');
    if (statusTab === 'refund')   rows = rows.filter(r => r.status === 'refund');

    // Staff
    if (staffFilter) rows = rows.filter(r => r.staffName === staffFilter);

    // Client search
    if (clientSearch.trim()) {
      const kw = clientSearch.trim().toLowerCase();
      rows = rows.filter(r => r.clientName.toLowerCase().includes(kw));
    }
    return rows;
  }, [allRows, statusTab, staffFilter, clientSearch]);

  // ─── 統計 badge ───────────────────────────────────
  const counts = useMemo(() => ({
    all: allRows.filter(r => r.status !== 'void').length,
    buffer: allRows.filter(r => r.status === 'buffer').length,
    confirmed: allRows.filter(r => r.status === 'confirmed').length,
    refund: allRows.filter(r => r.status === 'refund').length,
  }), [allRows]);

  const summary = useMemo(() => {
    const buf = allRows.filter(r => r.status === 'buffer');
    const conf = allRows.filter(r => r.status === 'confirmed');
    const ref = allRows.filter(r => r.status === 'refund');
    const bufPending = buf.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
    const confEarned = conf.reduce((s, r) => s + r.paid, 0);
    const refundTotal = ref.reduce((s, r) => s + r.paid, 0);
    return { bufPending, confEarned, refundTotal };
  }, [allRows]);

  // ─── helper ────────────────────────────────────────
  const progressBar = (pct, status) => (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            status === 'refund' ? 'bg-red-400' : status === 'buffer' ? 'bg-amber-400' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-9 text-right tabular-nums ${
        status === 'refund' ? 'text-red-500' : status === 'buffer' ? 'text-amber-600' : 'text-emerald-600'
      }`}>
        {pct}%
      </span>
    </div>
  );

  const statusPill = (status) => {
    const map = {
      buffer:    'bg-amber-100 text-amber-700 border-amber-200',
      confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      refund:    'bg-red-100 text-red-700 border-red-200',
      void:      'bg-gray-100 text-gray-400 border-gray-200',
    };
    const label = { buffer: '緩存', confirmed: '完成', refund: '退款', void: '已退回' };
    const dot   = { buffer: 'bg-amber-500', confirmed: 'bg-emerald-500', refund: 'bg-red-500', void: 'bg-gray-400' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${map[status]}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />{label[status]}
      </span>
    );
  };

  const statsRow = useMemo(() => {
    const buf = allRows.filter(r => r.status === 'buffer');
    const conf = allRows.filter(r => r.status === 'confirmed');
    const ref = allRows.filter(r => r.status === 'refund');
    const debt = buf.filter(r => r.sessionsRemaining === 0 && r.paid < r.total);
    const unserved = buf.filter(r => r.sessionsRemaining > 0);
    const now = new Date();
    const risk = buf.filter(r => Math.floor((now - new Date(r.date)) / MS_PER_DAY) > 60 && r.paid < r.total);
    const thisMonth = TODAY.slice(0, 7) + '-01';
    const confThis = conf.filter(r => r.date >= thisMonth);
    const confPast = conf.filter(r => r.date < thisMonth);
    const refThis = ref.filter(r => r.date >= thisMonth);
    const refPast = ref.filter(r => r.date < thisMonth);
    return { debt, unserved, risk, confThis, confPast, refThis, refPast, bufCount: buf.length, confCount: conf.length, refCount: ref.length };
  }, [allRows]);

  const chips = useMemo(() => {
    if (statusTab === 'all') return null;
    if (statusTab === 'buffer') {
      const debtAmt = statsRow.debt.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
      const unsAmt = statsRow.unserved.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
      const riskAmt = statsRow.risk.reduce((s, r) => s + Math.max(0, r.total - r.paid), 0);
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">快捷篩選：</span>
          <Chip label="欠款未找" count={statsRow.debt.length} extra={fmtMoney(debtAmt)} color="amber" />
          <Chip label="未做套票" count={statsRow.unserved.length} extra={fmtMoney(unsAmt)} color="amber" />
          <Chip label={`風險 >${60}日`} count={statsRow.risk.length} extra={fmtMoney(riskAmt)} color="red" />
        </div>
      );
    }
    if (statusTab === 'confirmed') {
      const thisAmt = statsRow.confThis.reduce((s, r) => s + r.paid, 0);
      const pastAmt = statsRow.confPast.reduce((s, r) => s + r.paid, 0);
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">快捷篩選：</span>
          <Chip label="本月完成" count={statsRow.confThis.length} extra={fmtMoney(thisAmt)} color="emerald" />
          <Chip label="過往累積" count={statsRow.confPast.length} extra={fmtMoney(pastAmt)} color="emerald" />
        </div>
      );
    }
    if (statusTab === 'refund') {
      const thisAmt = statsRow.refThis.reduce((s, r) => s + r.paid, 0);
      const pastAmt = statsRow.refPast.reduce((s, r) => s + r.paid, 0);
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-text-muted">快捷篩選：</span>
          <Chip label="本月退款" count={statsRow.refThis.length} extra={fmtMoney(thisAmt)} color="red" />
          <Chip label="過往退款" count={statsRow.refPast.length} extra={fmtMoney(pastAmt)} color="red" />
        </div>
      );
    }
    return null;
  }, [statusTab, statsRow]);

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3">
      {/* ═══ Header ═══ */}
      <header className="shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">💰 收入紀錄</h1>
          <p className="text-text-muted text-xs mt-0.5">全部訂單交易列表 — 點擊上方狀態篩選即時過濾</p>
        </div>
        <button onClick={() => exportSales(supabase)}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-gray-200 text-text rounded-xl text-sm font-bold hover:bg-bg transition-colors shadow-sm">
          <ArrowDownTrayIcon className="w-4 h-4" /> 匯出 Excel
        </button>
      </header>

      {/* ═══ 頂部一體化控制列 ═══ */}
      <div className="shrink-0 bg-surface rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* 篩選列 */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100">
          {/* 日期 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted font-bold text-xs">📅</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px]" />
            <span className="text-gray-400 text-xs">~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px]" />
          </div>
          <div className="w-px h-6 bg-gray-200" />
          {/* 員工 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted font-bold text-xs">👤</span>
            <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px] min-w-[90px]">
              <option value="">全部經手人</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          {/* 客戶搜尋 */}
          <div className="flex items-center gap-2 text-sm flex-1 min-w-[150px]">
            <MagnifyingGlassIcon className="w-4 h-4 text-text-muted shrink-0" />
            <input type="text" placeholder="搜尋客戶姓名..."
              value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-bg min-h-[36px] outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {/* Summary inline */}
          <div className="flex items-center gap-3 ml-auto text-xs">
            <span className="text-amber-600 font-bold">🟡 緩存 {counts.buffer}</span>
            <span className="text-emerald-600 font-bold">🟢 完成 {counts.confirmed}</span>
            <span className="text-red-500 font-bold">🔴 退款 {counts.refund}</span>
            <span className="w-px h-4 bg-gray-200" />
            <span className="font-bold text-gray-700">共 {counts.all} 筆</span>
          </div>
        </div>

        {/* 狀態 Tabs + 快捷 chips */}
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <StatusTab active={statusTab === 'all'} onClick={() => setStatusTab('all')} count={counts.all}>全部</StatusTab>
          <StatusTab active={statusTab === 'buffer'} onClick={() => setStatusTab('buffer')} count={counts.buffer} color="amber">緩存中</StatusTab>
          <StatusTab active={statusTab === 'confirmed'} onClick={() => setStatusTab('confirmed')} count={counts.confirmed} color="emerald">確定收入</StatusTab>
          <StatusTab active={statusTab === 'refund'} onClick={() => setStatusTab('refund')} count={counts.refund} color="red">退款紀錄</StatusTab>
          <div className="flex-1" />
          {chips}
        </div>
      </div>

      {/* ═══ 表格 ═══ */}
      <div className="flex-1 min-h-0 overflow-auto bg-surface rounded-xl border border-gray-200 shadow-sm flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0 sticky top-0 z-0">
          <h3 className="font-bold text-text text-sm">📋 訂單明細</h3>
          <span className="text-xs text-text-muted">{filteredRows.length} 筆</span>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredRows.length > 0 ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-0">
                <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                  <th className="px-4 py-3 font-bold">客戶</th>
                  <th className="px-4 py-3 font-bold">療程</th>
                  <th className="px-4 py-3 font-bold">已收 / 總額</th>
                  <th className="px-4 py-3 font-bold w-44">進度</th>
                  <th className="px-4 py-3 font-bold">最後異動日</th>
                  <th className="px-4 py-3 font-bold">經手人</th>
                  <th className="px-4 py-3 font-bold">狀態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRows.map(row => (
                  <tr key={row.id} className={`hover:bg-gray-50/60 transition-colors ${row.type === 'void' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3.5 font-bold">{row.clientName}</td>
                    <td className="px-4 py-3.5">{row.treatmentName}</td>
                    <td className="px-4 py-3.5 font-mono text-sm">
                      <span className={`font-bold ${row.status === 'refund' ? 'text-red-500' : row.status === 'buffer' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {fmtMoney(row.paid)}
                      </span>
                      {row.total > 0 && <span className="text-gray-400"> / {fmtMoney(row.total)}</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.status === 'refund' ? (
                        <span className="text-xs text-text-muted">{row.reason?.slice(0, 20) || '—'}</span>
                      ) : (
                        progressBar(row.pct, row.status)
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-gray-700">{row.date?.slice(5)}</span>
                      <span className="text-[10px] text-text-muted ml-1.5">({row.dateLabel})</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">{row.staffName}</td>
                    <td className="px-4 py-3.5">{statusPill(row.status)}</td>
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

// ─── 子組件 ──────────────────────────────────────────
const StatusTab = ({ active, onClick, count, color, children }) => {
  const colors = {
    amber:   'data-[active=true]:bg-amber-100 data-[active=true]:text-amber-800 data-[active=true]:border-amber-300',
    emerald: 'data-[active=true]:bg-emerald-100 data-[active=true]:text-emerald-800 data-[active=true]:border-emerald-300',
    red:     'data-[active=true]:bg-red-100 data-[active=true]:text-red-800 data-[active=true]:border-red-300',
  };
  return (
    <button
      onClick={onClick}
      data-active={active}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all
        ${active ? (colors[color] || 'bg-gray-100 text-gray-800 border-gray-300') : 'text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-700'}`}
    >
      {children}
      <span className={`${active ? 'opacity-70' : 'text-gray-400'}`}>{count}</span>
    </button>
  );
};

const Chip = ({ label, count, extra, color }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold
    ${color === 'amber' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
    ${color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
    ${color === 'red' ? 'bg-red-50 text-red-700 border border-red-200' : ''}
  `}>
    {label} <span className="opacity-60">{count}</span>
    {extra && <span className="ml-0.5 opacity-80">{extra}</span>}
  </span>
);

export default SettlementPage;
