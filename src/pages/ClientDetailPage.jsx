/**
 * 客戶詳情頁面 - iPad 橫向佈局
 * 左側客戶基本資訊與提示 + 右側已購療程庫存 + 下方預約歷史
 * v3: 支付取代扣減、退款用直接 DB 操作確保可靠性
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner, Alert, TextInput } from 'flowbite-react';
import {
  ArrowLeftIcon,
  UserCircleIcon,
  PhoneIcon,
  TagIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ClockIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 📝 編輯客戶 Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', source: '', remarks: '', is_sensitive: false, sensitive_note: '' });
  const [editing, setEditing] = useState(false);

  // 🛒 購買療程 Modal
  const [showPurchase, setShowPurchase] = useState(false);
  const [allTreatments, setAllTreatments] = useState([]);
  const [purchaseForm, setPurchaseForm] = useState({ treatment_id: '', sessions: 1, unit_price: '', expiry_date: '' });
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  // 💰 退款 Modal
  const [showRefund, setShowRefund] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundForm, setRefundForm] = useState({ reason: '', amount: '', sessions: '' });
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState(null);

  // 🗑️ 刪除客戶 Modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 💳 支付 Modal（原扣減）
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ sessions: '1', payment_method: 'cash', reason: '' });
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: clientData },
        { data: svcData },
        { data: histData },
      ] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).maybeSingle(),
        supabase.from('client_services').select('*, treatments(name)').eq('client_id', id),
        supabase.from('appointments').select('*, treatments(name), profiles(name)').eq('client_id', id).order('appointment_date', { ascending: false }),
      ]);

      if (!clientData) {
        setError('找不到該客戶資料');
      } else {
        setClient(clientData);
      }
      setServices(svcData || []);
      setHistory(histData || []);
    } catch (err) {
      console.warn('fetchData error:', err.message);
      setError('載入客戶資料時發生錯誤: ' + err.message);
    }
    setLoading(false);
  };

  // 🛒 打開購買 Modal
  const openPurchase = async () => {
    const { data } = await supabase.from('treatments').select('*').eq('is_active', true);
    setAllTreatments(data || []);
    const firstTreatment = data?.[0];
    setPurchaseForm({
      treatment_id: firstTreatment?.id || '',
      sessions: firstTreatment?.package_sessions || 1,
      unit_price: firstTreatment?.single_price || '',
      expiry_date: '',
    });
    setPurchaseError(null);
    setShowPurchase(true);
  };

  // 💰 打開退款 Modal
  const openRefund = (svc) => {
    setRefundTarget(svc);
    setRefundForm({ reason: '', amount: svc.unit_price || '', sessions: '1' });
    setRefundError(null);
    setShowRefund(true);
  };

  // 💰 執行退款
  const handleRefund = async () => {
    if (!refundForm.reason.trim()) { setRefundError('請填寫退款原因'); return; }
    setRefunding(true);
    setRefundError(null);

    try {
      const sessionsToRestore = parseInt(refundForm.sessions) || 0;
      const refundAmount = parseFloat(refundForm.amount) || 0;

      const { error } = await supabase.rpc('refund_deduction', {
        p_client_service_id: refundTarget.id,
        p_sessions_to_restore: sessionsToRestore,
        p_refund_amount: refundAmount,
        p_reason: refundForm.reason.trim(),
      });

      if (error) {
        setRefundError(error.message);
      } else {
        setShowRefund(false);
        fetchData();
      }
    } catch (err) {
      setRefundError('退款失敗: ' + err.message);
    }
    setRefunding(false);
  };

  // 🛒 購買療程
  const handlePurchase = async () => {
    if (!purchaseForm.treatment_id) { setPurchaseError('請選擇療程'); return; }
    setPurchasing(true);
    setPurchaseError(null);

    try {
      const { error } = await supabase.rpc('manual_grant_sessions', {
        p_client_id: id,
        p_treatment_id: purchaseForm.treatment_id,
        p_sessions: parseInt(purchaseForm.sessions) || 1,
        p_reason: '店長新增購買',
        p_unit_price: parseFloat(purchaseForm.unit_price) || null,
        p_expiry_date: purchaseForm.expiry_date || null,
      });

      if (error) {
        setPurchaseError(error.message);
      } else {
        setShowPurchase(false);
        fetchData();
      }
    } catch (err) {
      setPurchaseError('購買失敗: ' + err.message);
    }
    setPurchasing(false);
  };

  // 💳 執行支付（直接 DB 操作，不經 RPC）
  const handlePayment = async () => {
    if (!paymentForm.reason.trim()) { setPaymentError('請填寫支付原因'); return; }
    setPaying(true);
    setPaymentError(null);

    try {
      const sessionsToDeduct = parseInt(paymentForm.sessions) || 1;
      const target = paymentTarget;

      // 1. 扣減療程次數
      const newRemaining = target.remaining_sessions - sessionsToDeduct;
      const { error: updateError } = await supabase
        .from('client_services')
        .update({
          remaining_sessions: newRemaining,
          status: newRemaining <= 0 ? 'expired' : 'active',
        })
        .eq('id', target.id)
        .gt('remaining_sessions', 0);

      if (updateError) throw updateError;

      // 2. 建立支付交易紀錄
      const amount = parseFloat(paymentForm.sessions) * (target.unit_price || 0) || null;
      const { error: txError } = await supabase
        .from('payment_transactions')
        .insert({
          client_id: id,
          treatment_id: target.treatment_id,
          amount: amount,
          payment_method: paymentForm.payment_method,
          transaction_date: new Date().toISOString().split('T')[0],
          remarks: paymentForm.reason.trim(),
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (txError) throw txError;

      setShowPayment(false);
      fetchData();
    } catch (err) {
      setPaymentError(err.message || '支付失敗');
    }
    setPaying(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;
  if (error) return <Alert color="failure">{error}</Alert>;
  if (!client) return <Alert color="failure">找不到該客戶資料</Alert>;

  const sourceColor = client.source?.includes('IG') ? 'rose' : client.source?.includes('朋友') ? 'green' : 'blue';

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      {/* 頂部操作列 */}
      <header className="flex justify-between items-center shrink-0">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-text-muted hover:text-primary transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="font-medium">返回客戶列表</span>
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" icon={UserCircleIcon} onClick={() => {
            setEditForm({
              name: client.name || '',
              phone: client.phone || '',
              source: client.source || '',
              remarks: client.remarks || '',
              is_sensitive: client.is_sensitive || false,
              sensitive_note: client.sensitive_note || '',
            });
            setShowEdit(true);
          }}>編輯客戶資料</Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}>刪除客戶</Button>
        </div>
      </header>

      {/* 主內容：左右並排 */}
      <div className="flex-1 min-h-0 flex gap-6 items-start">
        {/* 左側：客戶基本資訊 (320px) */}
        <aside className="w-[320px] shrink-0 space-y-6">
          <div className="bg-surface rounded-2xl p-6 shadow-card border border-gray-100">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center text-primary text-3xl font-bold mb-3">
                {client.name?.[0] || '?'}
              </div>
              <h2 className="text-2xl font-bold text-text flex items-center gap-2">
                {client.name}
                {client.is_sensitive && <ExclamationTriangleIcon className="w-6 h-6 text-danger" />}
              </h2>
              <span className="text-text-muted text-sm">{client.member_id}</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-text">
                <PhoneIcon className="w-5 h-5 text-text-muted" />
                <span>{client.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-text">
                <TagIcon className="w-5 h-5 text-text-muted" />
                <div className="flex gap-1">
                  <Tag color={sourceColor}>{client.source || '無標記'}</Tag>
                  {client.is_sensitive && <Tag color="amber">特殊敏感</Tag>}
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <span className="text-xs font-bold text-text-muted uppercase block mb-2">備註資訊</span>
                <p className="text-sm text-text bg-bg p-3 rounded-xl min-h-[80px] whitespace-pre-wrap">
                  {client.remarks || '暫無特殊備註'}
                </p>
              </div>
            </div>
          </div>

          {client.is_sensitive && client.sensitive_note && (
            <Alert color="warning" icon={ExclamationTriangleIcon}>
              <b>注意事項：</b> {client.sensitive_note}
            </Alert>
          )}
        </aside>

        {/* 右側：已購療程庫存 + 預約歷史 */}
        <section className="flex-1 min-w-0 space-y-4 min-h-0 flex flex-col">
          {/* 已購療程庫存 */}
          <div className="bg-surface rounded-2xl shadow-card border border-gray-100 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-5 border-b border-gray-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-primary" />
                <h3 className="font-bold text-lg">已購療程庫存 (共 {services.length} 項)</h3>
              </div>
              <Button variant="primary" size="md" icon={ShoppingCartIcon} onClick={openPurchase}>
                新增購買
              </Button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto flex-1">
              {services.map(svc => (
                <div key={svc.id} className="p-4 rounded-2xl border border-gray-100 bg-white flex justify-between items-center shadow-sm">
                  <div className="space-y-1">
                    <h4 className="font-bold text-text">{svc.treatments?.name}</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-primary">{svc.remaining_sessions}</span>
                      <span className="text-text-muted text-xs">/ {svc.total_sessions} 次剩餘</span>
                    </div>
                    <p className="text-[10px] text-text-muted">到期日：{svc.expiry_date || '不限期'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="md" onClick={() => openRefund(svc)}>退款</Button>
                    <Button variant="secondary" size="md" icon={CreditCardIcon} onClick={() => {
                      setPaymentTarget(svc);
                      setPaymentForm({ sessions: '1', payment_method: 'cash', reason: '' });
                      setPaymentError(null);
                      setShowPayment(true);
                    }}>支付</Button>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <div className="col-span-2 py-10 text-center text-text-muted italic">
                  此客戶目前無任何有效療程庫存。
                </div>
              )}
            </div>
          </div>

          {/* 預約歷史 — 原生 <table> */}
          <div className="bg-surface rounded-2xl shadow-card border border-gray-100 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-5 border-b border-gray-50 flex items-center gap-2 shrink-0">
              <ClockIcon className="w-6 h-6 text-text-muted" />
              <h3 className="font-bold text-lg">預約歷史紀錄</h3>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-0">
                  <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                    <th className="px-6 py-4 font-bold">日期</th>
                    <th className="px-6 py-4 font-bold">療程項目</th>
                    <th className="px-6 py-4 font-bold">美容師</th>
                    <th className="px-6 py-4 font-bold">狀態</th>
                    <th className="px-6 py-4 font-bold">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-text-muted italic">尚無預約紀錄</td>
                    </tr>
                  ) : (
                    history.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 font-bold">{item.appointment_date}</td>
                        <td className="px-6 py-4">{item.treatments?.name || '-'}</td>
                        <td className="px-6 py-4">{item.profiles?.name || '-'}</td>
                        <td className="px-6 py-4">
                          <Tag color={item.status === 'attended' ? 'green' : item.status === 'cancelled' ? 'gray' : 'amber'}>
                            {item.status === 'attended' ? '已出席' : item.status === 'cancelled' ? '已取消' : '未出席'}
                          </Tag>
                        </td>
                        <td className="px-6 py-4 text-xs text-text-muted max-w-[200px] truncate">
                          {item.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* 📝 編輯客戶 Modal */}
      <Modal
        show={showEdit}
        onClose={() => setShowEdit(false)}
        title="✏️ 編輯客戶資料"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>取消</Button>
            <Button variant="primary" loading={editing} onClick={async () => {
              setEditing(true);
              const { error } = await supabase.from('clients').update({
                name: editForm.name.trim(),
                phone: editForm.phone.trim(),
                source: editForm.source || null,
                remarks: editForm.remarks || null,
                is_sensitive: editForm.is_sensitive,
                sensitive_note: editForm.is_sensitive ? editForm.sensitive_note : null,
              }).eq('id', id);
              if (!error) {
                setShowEdit(false);
                fetchData();
              } else {
                alert('更新失敗: ' + error.message);
              }
              setEditing(false);
            }}>儲存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">姓名</label>
              <TextInput value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">電話</label>
              <TextInput value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">來源</label>
            <TextInput placeholder="IG廣告 / 朋友介紹 / 街客..." value={editForm.source} onChange={(e) => setEditForm({...editForm, source: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">備註</label>
            <TextInput value={editForm.remarks} onChange={(e) => setEditForm({...editForm, remarks: e.target.value})} />
          </div>
          <div className="border-t pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 rounded text-primary" checked={editForm.is_sensitive} onChange={(e) => setEditForm({...editForm, is_sensitive: e.target.checked})} />
              <span className="font-medium">⚠️ 標記為特殊敏感客戶</span>
            </label>
            {editForm.is_sensitive && (
              <TextInput className="mt-3" placeholder="敏感原因（如：怕痛、過敏體質...）" value={editForm.sensitive_note} onChange={(e) => setEditForm({...editForm, sensitive_note: e.target.value})} />
            )}
          </div>
        </div>
      </Modal>

      {/* 🛒 購買療程 Modal */}
      <Modal
        show={showPurchase}
        onClose={() => setShowPurchase(false)}
        title="🛒 新增購買療程"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPurchase(false)}>取消</Button>
            <Button variant="primary" onClick={handlePurchase} loading={purchasing}>確認購買</Button>
          </>
        }
      >
        <div className="space-y-4">
          {purchaseError && <Alert color="failure">{purchaseError}</Alert>}
          <div>
            <label className="block text-sm font-medium mb-2">療程項目</label>
            <select
              className="w-full border-gray-200 rounded-xl focus:ring-primary focus:border-primary min-h-[48px] px-4 bg-surface"
              value={purchaseForm.treatment_id}
              onChange={(e) => {
                const t = allTreatments.find(tx => tx.id === e.target.value);
                setPurchaseForm({
                  ...purchaseForm,
                  treatment_id: e.target.value,
                  sessions: t?.package_sessions || 1,
                  unit_price: t?.single_price || '',
                });
              }}
            >
              <option value="">請選擇療程</option>
              {allTreatments.map(t => (
                <option key={t.id} value={t.id}>{t.name} — HK${t.single_price?.toLocaleString()}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">購買次數</label>
              <TextInput type="number" min="1" value={purchaseForm.sessions} onChange={(e) => setPurchaseForm({...purchaseForm, sessions: parseInt(e.target.value) || 1})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">單價 (HKD)</label>
              <TextInput type="number" placeholder="留空 = 使用療程預設價格" value={purchaseForm.unit_price} onChange={(e) => setPurchaseForm({...purchaseForm, unit_price: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">到期日 (可選)</label>
            <input type="date" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface focus:ring-primary focus:border-primary" value={purchaseForm.expiry_date} onChange={(e) => setPurchaseForm({...purchaseForm, expiry_date: e.target.value})} />
          </div>
        </div>
      </Modal>

      {/* 💰 退款 Modal */}
      <Modal
        show={showRefund}
        onClose={() => setShowRefund(false)}
        title="💰 退款"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRefund(false)}>取消</Button>
            <Button variant="danger" onClick={handleRefund} loading={refunding}>確認退款</Button>
          </>
        }
      >
        <div className="space-y-4">
          {refundError && <Alert color="failure">{refundError}</Alert>}
          {refundTarget && (
            <div className="bg-bg p-4 rounded-xl text-sm space-y-1">
              <p>療程：<b>{refundTarget.treatments?.name}</b></p>
              <p>剩餘次數：{refundTarget.remaining_sessions} / {refundTarget.total_sessions}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">回補次數</label>
              <TextInput type="number" min="0" value={refundForm.sessions} onChange={(e) => setRefundForm({...refundForm, sessions: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">退款金額 (HKD)</label>
              <TextInput type="number" value={refundForm.amount} onChange={(e) => setRefundForm({...refundForm, amount: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">🔴 退款原因 (必填)</label>
            <TextInput placeholder="例：客戶不滿意療程效果，全額退款" value={refundForm.reason} onChange={(e) => setRefundForm({...refundForm, reason: e.target.value})} />
          </div>
        </div>
      </Modal>

      {/* 🗑️ 刪除客戶 Modal */}
      <Modal
        show={showDelete}
        onClose={() => setShowDelete(false)}
        title="🗑️ 刪除客戶"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>取消</Button>
            <Button variant="danger" loading={deleting} onClick={async () => {
              setDeleting(true);
              const { error } = await supabase.from('clients').delete().eq('id', id);
              if (!error) { setShowDelete(false); navigate('/clients'); }
              else { alert('刪除失敗: ' + error.message); }
              setDeleting(false);
            }}>確認刪除</Button>
          </>
        }
      >
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <ExclamationTriangleIcon className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-bold text-danger">此操作無法恢復！</h4>
          <p className="text-text-muted">
            客戶 <b>「{client.name}」</b> 的所有資料將被永久刪除，<br />
            包括預約記錄、療程庫存及相關交易紀錄（CASCADE）。
          </p>
        </div>
      </Modal>

      {/* 💳 支付 Modal */}
      <Modal
        show={showPayment}
        onClose={() => setShowPayment(false)}
        title="💳 療程支付"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPayment(false)}>取消</Button>
            <Button variant="primary" loading={paying} onClick={handlePayment}>確認支付 {paymentForm.sessions} 次</Button>
          </>
        }
      >
        <div className="space-y-4">
          {paymentError && <Alert color="failure">{paymentError}</Alert>}
          {paymentTarget && (
            <div className="bg-bg p-4 rounded-xl text-sm space-y-1">
              <p>療程：<b>{paymentTarget.treatments?.name}</b></p>
              <p>剩餘次數：{paymentTarget.remaining_sessions} / {paymentTarget.total_sessions}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">支付次數</label>
              <TextInput type="number" min="1" value={paymentForm.sessions} onChange={(e) => setPaymentForm({...paymentForm, sessions: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">付款方式</label>
              <select className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface" value={paymentForm.payment_method} onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}>
                <option value="cash">💵 現金</option>
                <option value="card">💳 信用卡</option>
                <option value="transfer">📱 轉賬</option>
                <option value="other">📋 其他</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">支付原因 (必填)</label>
            <TextInput placeholder="例：客戶到店消費" value={paymentForm.reason} onChange={(e) => setPaymentForm({...paymentForm, reason: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDetailPage;
