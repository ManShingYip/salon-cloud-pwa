/**
 * 扣減療程確認彈窗
 * 當預約改為「已出席」時自動彈出，讓員工選擇要扣減的療程庫存
 */
import React, { useState, useEffect } from 'react';
import { Checkbox, Table, Spinner, Alert } from 'flowbite-react';
import { supabase } from '@/config/supabase';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';

const DeductionModal = ({ show, onClose, appointment }) => {
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
      setError("請至少選擇一個要扣減的療程");
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
      setError(err.message || "扣減失敗，請稍後再試");
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
      title="🔔 扣減療程確認"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleConfirm} loading={submitting}>✅ 確認扣減</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="bg-bg p-4 rounded-xl space-y-2">
          <p><span className="text-text-muted">客戶：</span><span className="font-bold">{appointment.clients?.name}</span> ({appointment.clients?.member_id})</p>
          <p><span className="text-text-muted">預約：</span><span className="font-bold">{appointment.treatments?.name}</span> @ {appointment.start_time}</p>
        </div>

        <div>
          <h4 className="font-bold mb-3">請選擇要扣減的療程項目：</h4>
          {loading ? (
            <div className="flex justify-center p-6"><Spinner /></div>
          ) : services.length > 0 ? (
            <div className="border rounded-xl overflow-hidden">
              <Table hoverable>
                <Table.Head className="bg-gray-50">
                  <Table.HeadCell className="w-12"></Table.HeadCell>
                  <Table.HeadCell>療程名稱</Table.HeadCell>
                  <Table.HeadCell>剩餘次數</Table.HeadCell>
                </Table.Head>
                <Table.Body className="divide-y">
                  {services.map((s) => (
                    <Table.Row 
                      key={s.id} 
                      className={`cursor-pointer active:bg-gray-100 ${selectedIds.includes(s.id) ? 'bg-primary-light/10' : ''}`}
                      onClick={() => toggleSelect(s.id)}
                    >
                      <Table.Cell className="p-4">
                        <Checkbox 
                          checked={selectedIds.includes(s.id)} 
                          onChange={() => toggleSelect(s.id)}
                          className="w-6 h-6 rounded-lg text-primary focus:ring-primary"
                        />
                      </Table.Cell>
                      <Table.Cell className="font-medium text-text">
                        {s.treatments?.name}
                        {s.treatments?.is_active === false && (
                          <span className="text-xs text-warning ml-2">(已停用)</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Tag color={s.remaining_sessions <= 2 ? 'amber' : 'green'}>
                          剩餘 {s.remaining_sessions} / {s.total_sessions} 次
                        </Tag>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          ) : (
            <Alert color="warning">該客戶目前沒有可用的預購療程，請先進行充值或現場購買。</Alert>
          )}
        </div>

        {error && <Alert color="failure">{error}</Alert>}
        
        <p className="text-xs text-text-muted text-center italic">
          * 系統將自動扣減選中項目的 1 次庫存，並將預約狀態更新為「已出席」。
        </p>
      </div>
    </Modal>
  );
};

export default DeductionModal;
