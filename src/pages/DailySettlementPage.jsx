/**
 * 每日結算板頁面
 * 加總當日收入，處理支付方式分組，並鎖定結算
 */
import React, { useState, useEffect } from 'react';
import { Table, Textarea, Alert, Badge, Spinner } from 'flowbite-react';
import { LockClosedIcon, CheckCircleIcon, BanknotesIcon, CreditCardIcon, ArrowsRightLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const DailySettlementPage = () => {
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState([]);
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [date]);

  const fetchData = async () => {
    setLoading(true);
    // 獲取當日交易
    const { data: txData } = await supabase
      .from('payment_transactions')
      .select(`*, clients(name), treatments(name)`)
      .eq('transaction_date', date);
    
    // 獲取已有的結算紀錄
    const { data: setlData } = await supabase
      .from('daily_settlements')
      .select('*')
      .eq('settlement_date', date)
      .maybeSingle();

    setTransactions(txData || []);
    setSettlement(setlData);
    if (setlData) setRemark(setlData.remarks || '');
    setLoading(false);
  };

  const totals = transactions.reduce((acc, tx) => {
    acc.total += tx.amount;
    acc[tx.payment_method] = (acc[tx.payment_method] || 0) + tx.amount;
    return acc;
  }, { total: 0, cash: 0, card: 0, transfer: 0 });

  const handleFinalize = async () => {
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { error } = await supabase.rpc('close_daily_settlement', {
      p_settlement_date: date,
      p_difference_note: remark || null,
    });

    if (!error) {
      setShowConfirm(false);
      fetchData();
    } else {
      alert('結算失敗: ' + error.message);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <header className="flex justify-between items-center bg-surface p-6 rounded-2xl shadow-card">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            📊 每日結算 — {date}
          </h1>
          <p className="text-text-muted mt-1">結算今日所有現金與電子支付明細</p>
        </div>
        {settlement?.status === 'locked' && (
          <Badge color="success" size="lg" icon={LockClosedIcon}>
            結算已鎖定
          </Badge>
        )}
      </header>

      {/* 收入總覽卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1 bg-primary text-white p-6 rounded-2xl shadow-lg">
          <span className="text-sm opacity-80 block mb-2">總收入</span>
          <span className="text-3xl font-bold">HK${totals.total.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <BanknotesIcon className="w-5 h-5" />
            <span className="text-sm">現金</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.cash.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <CreditCardIcon className="w-5 h-5" />
            <span className="text-sm">信用卡</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.card.toLocaleString()}</span>
        </div>
        <div className="bg-surface p-6 rounded-2xl shadow-card border border-gray-100">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <ArrowsRightLeftIcon className="w-5 h-5" />
            <span className="text-sm">轉賬</span>
          </div>
          <span className="text-xl font-bold text-text">HK${totals.transfer.toLocaleString()}</span>
        </div>
      </div>

      {/* 交易明細 */}
      <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-gray-50 flex justify-between items-center">
          <h3 className="font-bold italic">今日已完成療程交易明細</h3>
        </div>
        <Table hoverable>
          <Table.Head className="bg-bg">
            <Table.HeadCell>客戶</Table.HeadCell>
            <Table.HeadCell>療程項目</Table.HeadCell>
            <Table.HeadCell>支付方式</Table.HeadCell>
            <Table.HeadCell className="text-right">金額</Table.HeadCell>
          </Table.Head>
          <Table.Body className="divide-y">
            {transactions.map(tx => (
              <Table.Row key={tx.id} className="min-h-[56px]">
                <Table.Cell className="font-bold">{tx.clients?.name}</Table.Cell>
                <Table.Cell>{tx.treatments?.name}</Table.Cell>
                <Table.Cell>
                  <span className="capitalize">{tx.payment_method === 'cash' ? '💵 現金' : tx.payment_method === 'card' ? '💳 信用卡' : '📱 轉賬'}</span>
                </Table.Cell>
                <Table.Cell className="text-right font-bold text-primary">HK${tx.amount.toLocaleString()}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>

      {/* 備註與結算按鈕 */}
      <div className="bg-surface p-6 rounded-2xl shadow-card space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-text-muted" />
          備註 / 備用金差異說明
        </h3>
        <Textarea
          placeholder="若金額與實際現金有差異，請在此說明原因..."
          rows={3}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          disabled={settlement?.status === 'locked'}
          className="rounded-xl border-gray-200 focus:ring-primary focus:border-primary"
        />
        
        {settlement?.status !== 'locked' && (
          <div className="flex justify-center pt-4">
            <Button 
              variant="primary" 
              size="lg" 
              icon={LockClosedIcon}
              onClick={() => setShowConfirm(true)}
            >
              完成結算並鎖定 🔒
            </Button>
          </div>
        )}
      </div>

      {/* Finalize Confirmation Modal */}
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
            系統將封存今日所有交易紀錄並生成報表。<br/>
            如需調整請聯繫總管理員。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default DailySettlementPage;
