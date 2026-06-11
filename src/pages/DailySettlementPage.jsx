/**
 * 收入紀錄頁面
 * 可視化查詢 payment_transactions — 日期篩選、支付方式篩選、總計、每月加總、明細
 */
import React, { useState, useEffect } from 'react';
import { Table, Select, Spinner } from 'flowbite-react';
import { BanknotesIcon, CreditCardIcon, ArrowsRightLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';

const RevenuePage = () => {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = today.slice(0, 7) + '-01';

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState(''); // '' = 全部
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [from, to, method]);

  const fetchData = async () => {
    setLoading(true);
    let q = supabase
      .from('payment_transactions')
      .select('*, clients(name), treatments(name)')
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .order('transaction_date');

    if (method) q = q.eq('payment_method', method);

    const { data } = await q;
    setTransactions(data || []);
    setLoading(false);
  };

  const totals = transactions.reduce((acc, tx) => {
    const amt = parseFloat(tx.amount) || 0;
    acc.total += amt;
    acc[tx.payment_method] = (acc[tx.payment_method] || 0) + amt;
    return acc;
  }, { total: 0, cash: 0, card: 0, transfer: 0, other: 0 });

  // 每月加總
  const dailyTotals = {};
  transactions.forEach(tx => {
    dailyTotals[tx.transaction_date] = (dailyTotals[tx.transaction_date] || 0) + parseFloat(tx.amount || 0);
  });
  const dailyEntries = Object.entries(dailyTotals).sort();

  const days = Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header className="bg-surface p-6 rounded-2xl shadow-card">
        <h1 className="text-2xl font-bold text-text">💰 收入紀錄</h1>
        <p className="text-text-muted text-sm mt-1">查詢及瀏覽所有交易紀錄，不需鎖定、不需結算</p>
      </header>

      {/* 篩選器 */}
      <div className="bg-surface p-5 rounded-2xl shadow-card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">開始日期</label>
          <input type="date" className="border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">結束日期</label>
          <input type="date" className="border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">支付方式</label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="min-w-[140px]">
            <option value="">全部</option>
            <option value="cash">💵 現金</option>
            <option value="card">💳 信用卡</option>
            <option value="transfer">📱 轉賬</option>
            <option value="other">📋 其他</option>
          </Select>
        </div>
        <div className="flex-1 text-right text-sm text-text-muted">
          {from} ~ {to} · {days} 天
        </div>
      </div>

      {/* 總計卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 bg-primary text-white p-6 rounded-2xl shadow-lg">
          <span className="text-sm opacity-80 block mb-1">總收入</span>
          <span className="text-3xl font-bold">HK${totals.total.toLocaleString()}</span>
          <span className="text-xs opacity-70 block mt-1">{transactions.length} 筆交易</span>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <BanknotesIcon className="w-5 h-5" /><span className="text-sm">現金</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.cash.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <CreditCardIcon className="w-5 h-5" /><span className="text-sm">信用卡</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.card.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <ArrowsRightLeftIcon className="w-5 h-5" /><span className="text-sm">轉賬</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.transfer.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-5 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <ArrowsRightLeftIcon className="w-5 h-5" /><span className="text-sm">其他</span>
          </div>
          <span className="text-xl font-bold text-text">HK${(totals.other || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* 每月加總 */}
      {dailyEntries.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="p-5 border-b border-gray-50">
            <h3 className="font-bold">每月收入</h3>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {dailyEntries.map(([date, total]) => (
              <div key={date} className="text-center p-3 bg-bg rounded-xl">
                <span className="text-xs text-text-muted block">{date.slice(5)}</span>
                <span className="font-bold text-primary">HK${total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 交易明細 */}
      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold">交易明細</h3>
          <span className="text-xs text-text-muted">{transactions.length} 筆</span>
        </div>
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : transactions.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                <th className="px-6 py-4 font-bold">日期</th>
                <th className="px-6 py-4 font-bold">客戶</th>
                <th className="px-6 py-4 font-bold">療程</th>
                <th className="px-6 py-4 font-bold">支付</th>
                <th className="px-6 py-4 font-bold text-right">金額</th>
                <th className="px-6 py-4 font-bold">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.transaction_date}</td>
                  <td className="px-6 py-4 font-bold">{tx.clients?.name}</td>
                  <td className="px-6 py-4">{tx.treatments?.name}</td>
                  <td className="px-6 py-4">
                    {tx.payment_method === 'cash' ? '💵 現金' : tx.payment_method === 'card' ? '💳 信用卡' : tx.payment_method === 'transfer' ? '📱 轉賬' : tx.payment_method === 'other' ? '📋 其他' : tx.payment_method}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-primary">HK${(parseFloat(tx.amount) || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-text-muted max-w-[180px] truncate">{tx.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center py-16 text-text-muted">此期間暫無交易紀錄</p>
        )}
      </div>
    </div>
  );
};

export default RevenuePage;
