/**
 * PaymentModal — 通用支付彈窗
 *
 * 支援兩種模式：
 *   mode="appointment" → 從 DailyAppointmentsPage 來的，多選 client_services
 *   mode="manual"      → 從 ClientDetailPage 來的，單一療程 + 自由次數
 *
 * 設計理念：店長說了算，所有數字自由輸入，不強制驗證。
 */
import React, { useState, useEffect, useMemo } from 'react';
import { TextInput, Spinner, Alert } from 'flowbite-react';
import { supabase } from '@/config/supabase';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';

const PaymentModal = ({ show, onClose, mode = 'manual', appointment, clientService, clientName }) => {
  // ---------- Appointment 模式：多選服務 ----------
  const [services, setServices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  // ---------- 共用表單 ----------
  const [sessions, setSessions] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isAppointment = mode === 'appointment';

  // ---------- 載入服務列表 (Appointment 模式) ----------
  useEffect(() => {
    if (!show) return;
    if (isAppointment && appointment?.client_id) {
      setLoadingServices(true);
      supabase
        .from('client_services')
        .select('*, treatments(name)')
        .eq('client_id', appointment.client_id)
        .gt('remaining_sessions', 0)
        .then(({ data }) => {
          setServices(data || []);
          const matched = data?.find(s => s.treatment_id === appointment.treatment_id);
          if (matched) setSelectedIds([matched.id]);
          setLoadingServices(false);
        });
    }
  }, [show, appointment, isAppointment]);

  // ---------- 重置 ----------
  useEffect(() => {
    if (show) {
      setSessions('1');
      setPaymentMethod('cash');
      setNote('');
      setAmountReceived('');
      setError(null);
    }
  }, [show]);

  // ---------- 計算應收金額 ----------
  const computedAmount = useMemo(() => {
    if (isAppointment) {
      // Appointment: 所有選中服務的 unit_price 總和
      return services
        .filter(s => selectedIds.includes(s.id))
        .reduce((sum, s) => sum + (parseFloat(s.unit_price) || 0), 0);
    }
    // Manual: 單一療程 unit_price × sessions
    const price = parseFloat(clientService?.unit_price) || 0;
    return price * (parseInt(sessions) || 1);
  }, [isAppointment, services, selectedIds, clientService, sessions]);

  // ---------- 找續 ----------
  const change = useMemo(() => {
    const received = parseFloat(amountReceived) || 0;
    return received - computedAmount;
  }, [amountReceived, computedAmount]);

  // ---------- 預設實收 = 應收 ----------
  useEffect(() => {
    if (show && !amountReceived) {
      setAmountReceived(String(computedAmount));
    }
  }, [show, computedAmount]);

  // ---------- 執行支付 ----------
  const handleSubmit = async () => {
    setError(null);

    if (isAppointment && selectedIds.length === 0) {
      setError('請至少選擇一個療程項目');
      return;
    }

    setSubmitting(true);

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      if (isAppointment) {
        // Appointment 模式 → RPC
        const { error: rpcError } = await supabase.rpc('deduct_service_from_appointment', {
          p_appointment_id: appointment.id,
          p_service_ids: selectedIds,
          p_payment_method: paymentMethod,
          p_amount: computedAmount || null,
        });

        if (rpcError) throw rpcError;

        // 如果有實收，update payment_transactions
        const received = parseFloat(amountReceived) || 0;
        if (received > 0) {
          // 搵返最後一筆呢個 appointment 嘅 transaction 嚟 update
          const { data: txs } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('appointment_id', appointment.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (txs?.length) {
            await supabase
              .from('payment_transactions')
              .update({ amount_received: received, remarks: note || null })
              .eq('id', txs[0].id);
          }
        }

      } else {
        // Manual 模式 → 直接 DB
        const target = clientService;
        const sessionsToDeduct = parseInt(sessions) || 1;
        const newRemaining = target.remaining_sessions - sessionsToDeduct;
        const received = parseFloat(amountReceived) || null;

        // 1. Update client_services
        const { error: updateError } = await supabase
          .from('client_services')
          .update({
            remaining_sessions: newRemaining,
            status: newRemaining <= 0 ? 'expired' : 'active',
          })
          .eq('id', target.id);

        if (updateError) throw updateError;

        // 2. Insert payment_transactions
        const { error: txError } = await supabase
          .from('payment_transactions')
          .insert({
            client_id: target.client_id,
            treatment_id: target.treatment_id,
            staff_id: userId,
            amount: computedAmount,
            amount_received: received,
            payment_method: paymentMethod,
            transaction_date: new Date().toISOString().split('T')[0],
            settled_by: userId,
            remarks: note || null,
          });

        if (txError) throw txError;
      }

      onClose();
    } catch (err) {
      setError(err.message || '支付失敗');
    }
    setSubmitting(false);
  };

  // ---------- Appointment 模式專用勾選 ----------
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const unitLabel = isAppointment
    ? clientService?.treatments?.name || appointment?.treatments?.name || '療程'
    : clientService?.treatments?.name || '療程';

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={isAppointment ? '💳 支付確認' : '💳 療程支付'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            ✅ 確認支付
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {error && <Alert color="failure">{error}</Alert>}

        {/* ---- Appointment: 客戶資訊 ---- */}
        {isAppointment && appointment && (
          <div className="bg-bg p-4 rounded-xl space-y-1 text-sm">
            <p><span className="text-text-muted">客戶：</span><b>{appointment.clients?.name}</b> ({appointment.clients?.member_id})</p>
            <p><span className="text-text-muted">預約：</span><b>{appointment.treatments?.name}</b> @ {appointment.start_time}</p>
          </div>
        )}

        {/* ---- Manual: 療程資訊 ---- */}
        {!isAppointment && clientService && (() => {
          const totalPrice = parseFloat(clientService.total_price) || (parseFloat(clientService.unit_price) || 0) * (clientService.total_sessions || 0);
          const paidSoFar = totalPrice - (parseFloat(clientService.unit_price) || 0) * (clientService.remaining_sessions || 0);
          const paidPct = totalPrice > 0 ? Math.round((paidSoFar / totalPrice) * 100) : 0;
          return (
            <div className="bg-bg p-4 rounded-xl text-sm space-y-2">
              <p>療程：<b>{clientService.treatments?.name}</b></p>
              <p>剩餘：{clientService.remaining_sessions} / {clientService.total_sessions} 次</p>
              <p>單價：<b>HK${(parseFloat(clientService.unit_price) || 0).toLocaleString()}</b> / 次</p>
              {/* 進度 bar：已收 / 總額 */}
              <div className="pt-1">
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>已收 HK${paidSoFar.toLocaleString()}</span>
                  <span>總額 HK${totalPrice.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${paidPct >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                    style={{ width: `${paidPct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {paidPct >= 100 ? '🟢 已收足' : `🟡 緩存中 · 尚欠 HK$${(totalPrice - paidSoFar).toLocaleString()}`}
                </p>
              </div>
            </div>
          );
        })()}

        {/* ---- Appointment: 可選服務列表 ---- */}
        {isAppointment && (
          <div>
            <h4 className="font-bold mb-2 text-sm">選擇要支付的療程：</h4>
            {loadingServices ? (
              <div className="flex justify-center p-4"><Spinner /></div>
            ) : services.length > 0 ? (
              <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs uppercase text-text-muted border-b border-gray-100">
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 font-bold">療程</th>
                      <th className="px-3 py-2 font-bold">單價</th>
                      <th className="px-3 py-2 font-bold">剩餘</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {services.map(s => (
                      <tr
                        key={s.id}
                        className={`cursor-pointer ${selectedIds.includes(s.id) ? 'bg-primary-light/10' : ''}`}
                        onClick={() => toggleSelect(s.id)}
                      >
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)}
                            className="w-5 h-5 rounded text-primary focus:ring-primary" />
                        </td>
                        <td className="px-3 py-2 font-medium">{s.treatments?.name}</td>
                        <td className="px-3 py-2">HK${(parseFloat(s.unit_price) || 0).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <Tag color={s.remaining_sessions <= 2 ? 'amber' : 'green'}>
                            {s.remaining_sessions}/{s.total_sessions}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Alert color="warning">該客戶目前沒有可用的預購療程。</Alert>
            )}
          </div>
        )}

        {/* ---- Manual: 次數 ---- */}
        {!isAppointment && (
          <div>
            <label className="block text-sm font-medium mb-1">支付次數</label>
            <TextInput type="number" min="1" max={clientService?.remaining_sessions || 1}
              value={sessions} onChange={(e) => setSessions(e.target.value)} />
          </div>
        )}

        {/* ---- 應收金額 ---- */}
        <div className="bg-bg p-3 rounded-xl flex justify-between items-center">
          <span className="text-sm text-text-muted">應收金額</span>
          <span className="text-xl font-black text-primary">HK${computedAmount.toLocaleString()}</span>
        </div>

        {/* ---- 付款方式 ---- */}
        <div>
          <label className="block text-sm font-medium mb-1">付款方式</label>
          <select className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface focus:ring-primary focus:border-primary"
            value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">💵 現金</option>
            <option value="card">💳 信用卡</option>
            <option value="transfer">📱 轉賬</option>
            <option value="other">📋 其他</option>
          </select>
        </div>

        {/* ---- 實收金額 + 找續 ---- */}
        <div>
          <label className="block text-sm font-medium mb-1">
            實收金額 <span className="text-text-muted font-normal">（{paymentMethod === 'cash' ? '用於計算找續' : '可留空'}）</span>
          </label>
          <div className="flex items-center gap-4">
            <TextInput type="number" min="0" className="flex-1"
              value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)}
              placeholder={String(computedAmount)} />
            {change !== 0 && (
              <div className={`text-sm font-bold whitespace-nowrap px-3 py-2 rounded-lg ${change > 0 ? 'text-success bg-green-50' : 'text-danger bg-red-50'}`}>
                找續 {change > 0 ? '+' : ''}HK${change.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* ---- 備註 ---- */}
        <div>
          <label className="block text-sm font-medium mb-1">備註 <span className="text-text-muted font-normal">（選填）</span></label>
          <TextInput placeholder="例：客戶到店消費、尾數下次俾..." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

export default PaymentModal;
