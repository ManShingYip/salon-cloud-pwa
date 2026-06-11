/**
 * 每月結算板頁面
 * 選取月份，彙總該月所有交易，按支付方式分類，一鍵鎖定
 */
import React, { useState, useEffect } from 'react';
import { Table, Textarea, Alert, Badge, Spinner, Select } from 'flowbite-react';
import { LockClosedIcon, CheckCircleIcon, BanknotesIcon, CreditCardIcon, ArrowsRightLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const MonthlySettlementPage = () => {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [yearMonth, setYearMonth] = useState(thisMonth);
  const [transactions, setTransactions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [yearMonth]);

  const [yyyy, mm] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  const from = `${yearMonth}-01`;
  const to = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const fetchData = async () => {
    setLoading(true);
    const { data: txData } = await supabase
      .from('payment_transactions')
      .select('*, clients(name), treatments(name)')
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .order('transaction_date');

    const { data: settData } = await supabase
      .from('daily_settlements')
      .select('*')
      .gte('settlement_date', from)
      .lte('settlement_date', to);

    setTransactions(txData || []);
    setSettlements(settData || []);
    setLoading(false);
  };

  const totals = transactions.reduce((acc, tx) => {
    acc.total += tx.amount;
    acc[tx.payment_method] = (acc[tx.payment_method] || 0) + tx.amount;
    return acc;
  }, { total: 0, cash: 0, card: 0, transfer: 0 });

  const lockedDays = settlements.filter(s => s.status === 'locked');
  const isAllLocked = lockedDays.length > 0;

  const handleFinalize = async () => {
    setSubmitting(true);
    // 遍歷該月每一天進行鎖定
    let errors = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${yearMonth}-${String(d).padStart(2, '0')}`;
      const { error } = await supabase.rpc('close_daily_settlement', {
        p_settlement_date: date,
        p_difference_note: remark || null,
      });
      if (error) errors++;
    }
    setSubmitting(false);
    if (errors > 0) {
      alert(`部分日期鎖定失敗 (${errors}/${daysInMonth})，可能已被鎖定`);
    } else {
      setShowConfirm(false);
      fetchData();
    }
  };

  // 生成月份選項（過去 12 個月）
  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(d.toISOString().slice(0, 7));
  }

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="flex justify-between items-center bg-surface p-6 rounded-2xl shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">📊 每月結算</h1>
          <p className="text-text-muted mt-1">結算當月所有現金與電子支付明細</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="min-w-[140px]">
            {monthOptions.map(m => (
              <option key={m} value={m}>{m} 月</option>
            ))}
          </Select>
          {isAllLocked && (
            <Badge color="success" size="lg" icon={LockClosedIcon}>已鎖定 {lockedDays.length} 天</Badge>
          )}
        </div>
      </header>

      {/* 收入總覽 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 bg-primary text-white p-6 rounded-2xl shadow-lg">
          <span className="text-sm opacity-80 block mb-2">{yearMonth} 總收入</span>
          <span className="text-3xl font-bold">HK${totals.total.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <BanknotesIcon className="w-5 h-5" /><span className="text-sm">現金</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.cash.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <CreditCardIcon className="w-5 h-5" /><span className="text-sm">信用卡</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.card.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <ArrowsRightLeftIcon className="w-5 h-5" /><span className="text-sm">轉賬</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.transfer.toLocaleString()}</span>
        </div>
      </div>

      {/* 交易明細 */}
      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold">{yearMonth} 交易明細 ({transactions.length} 筆)</h3>
        </div>
        {transactions.length > 0 ? (
          <Table hoverable>
            <Table.Head className="bg-bg">
              <Table.HeadCell>日期</Table.HeadCell>
              <Table.HeadCell>客戶</Table.HeadCell>
              <Table.HeadCell>療程</Table.HeadCell>
              <Table.HeadCell>支付</Table.HeadCell>
              <Table.HeadCell className="text-right">金額</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {transactions.map(tx => (
                <Table.Row key={tx.id} className="min-h-[56px]">
                  <Table.Cell>{tx.transaction_date}</Table.Cell>
                  <Table.Cell className="font-bold">{tx.clients?.name}</Table.Cell>
                  <Table.Cell>{tx.treatments?.name}</Table.Cell>
                  <Table.Cell>
                    {tx.payment_method === 'cash' ? '💵 現金' : tx.payment_method === 'card' ? '💳 信用卡' : '📱 轉賬'}
                  </Table.Cell>
                  <Table.Cell className="text-right font-bold text-primary">HK${tx.amount.toLocaleString()}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <p className="text-center py-16 text-text-muted">此月暫無交易紀錄</p>
        )}
      </div>

      {/* 鎖定 */}
      <div className="bg-surface p-6 rounded-2xl shadow-card space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-text-muted" /> 鎖定結算
        </h3>
        <p className="text-sm text-text-muted">
          點擊下方按鈕會將 {yearMonth} 月份所有天數的結算鎖定。鎖定後該月份的交易將無法修改。
        </p>
        <Textarea
          placeholder="備註 / 差異說明（可選）..."
          rows={2}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          className="rounded-xl"
        />
        <div className="flex justify-center pt-4">
          <Button variant="primary" size="lg" icon={LockClosedIcon} onClick={() => setShowConfirm(true)} disabled={isAllLocked}>
            {isAllLocked ? '已鎖定' : '鎖定本月結算 🔒'}
          </Button>
        </div>
      </div>

      {/* 確認 Modal */}
      <Modal
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="🔒 鎖定結算確認"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirm(false)}>返回修改</Button>
            <Button variant="primary" onClick={handleFinalize} loading={submitting}>確認鎖定</Button>
          </>
        }
      >
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-bold">一旦鎖定將無法自行更改</h4>
          <p className="text-text-muted">
            系統將鎖定 {yearMonth} 月（{daysInMonth} 天）所有交易紀錄。<br/>
            如需調整請聯繫系統管理員。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default MonthlySettlementPage;
