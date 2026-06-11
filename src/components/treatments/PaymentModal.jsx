/**
 * 支付療程確認彈窗
 * 當預約改為「已出席」時自動彈出，讓員工選擇要支付的療程庫存
 */
import React, { useState, useEffect } from 'react';
import { Checkbox, Spinner, Alert } from 'flowbite-react';
import { supabase } from '@/config/supabase';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';

const PaymentModal = ({ show, onClose, appointment }) => {
  const [services, setServices] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && appointment?.client_id) {
      fetchClientServices();
    }
  }, [show, appointment]);

  const fetchClientServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_services')
      .select(`
        *,
        treatments (name, is_active)
      `)
      .eq('client_id', appointment.client_id)
      .gt('remaining_sessions', 0);

    if (!error) {
      setServices(data || []);
      // 預設勾選與預約療程 ID 相同的項目
      const matched = data?.find(s => s.treatment_id === appointment.treatment_id);
      if (matched) setSelectedIds([matched.id]);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      setError("請至少選擇一個要支付的療程");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc('deduct_service_from_appointment', {
        p_appointment_id: appointment.id,
        p_service_ids: selectedIds,
        p_payment_method: 'cash',
      });

      if (rpcError) throw rpcError;

      onClose();
    } catch (err) {
      setError(err.message || "支付失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <Modal
      show={show}
      onClose={onClose}
      title="💳 支付療程確認"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleConfirm} loading={submitting}>✅ 確認支付</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="bg-bg p-4 rounded-xl space-y-2">
          <p><span className="text-text-muted">客戶：</span><span className="font-bold">{appointment.clients?.name}</span> ({appointment.clients?.member_id})</p>
          <p><span className="text-text-muted">預約：</span><span className="font-bold">{appointment.treatments?.name}</span> @ {appointment.start_time}</p>
        </div>

        <div>
          <h4 className="font-bold mb-3">請選擇要支付的療程項目：</h4>
          {loading ? (
            <div className="flex justify-center p-6"><Spinner /></div>
          ) : services.length > 0 ? (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-text-muted border-b border-gray-100">
                    <th className="px-4 py-3 w-12"></th>
                    <th className="px-4 py-3 font-bold">療程名稱</th>
                    <th className="px-4 py-3 font-bold">剩餘次數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {services.map((s) => (
                    <tr
                      key={s.id}
                      className={`cursor-pointer ${selectedIds.includes(s.id) ? 'bg-primary-light/10' : ''}`}
                      onClick={() => toggleSelect(s.id)}
                    >
                      <td className="p-4">
                        <Checkbox
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="w-6 h-6 rounded-lg text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-text">
                        {s.treatments?.name}
                        {s.treatments?.is_active === false && (
                          <span className="text-xs text-warning ml-2">(已停用)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Tag color={s.remaining_sessions <= 2 ? 'amber' : 'green'}>
                          剩餘 {s.remaining_sessions} / {s.total_sessions} 次
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert color="warning">該客戶目前沒有可用的預購療程，請先進行購買或現場支付。</Alert>
          )}
        </div>

        {error && <Alert color="failure">{error}</Alert>}

        <p className="text-xs text-text-muted text-center italic">
          * 系統將自動支付選中項目的 1 次庫存，並將預約狀態更新為「已出席」。
        </p>
      </div>
    </Modal>
  );
};

export default PaymentModal;
