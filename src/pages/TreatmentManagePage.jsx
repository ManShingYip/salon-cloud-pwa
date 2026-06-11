/**
 * 療程管理頁面 (店長權限)
 * 列表顯示所有療程項目，支援新增、編輯、三層防禦停用機制
 * 🟢 無使用紀錄 → 可硬刪除
 * 🟡 有歷史但無活躍庫存 → 軟刪除 (is_active = false)
 * 🔴 有客戶持有有效套票 → 封鎖操作
 */
import React, { useState, useEffect } from 'react';
import { TextInput, Spinner, Alert } from 'flowbite-react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ShieldExclamationIcon,
  UsersIcon,
  CalendarDaysIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const TreatmentManagePage = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [deleteDeps, setDeleteDeps] = useState(null); // 關聯數據檢查結果
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [currentTreatment, setCurrentTreatment] = useState(null);
  const [formData, setFormData] = useState({ name: '', single_price: '', duration_minutes: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    setLoading(true);
    const { data } = await supabase.from('treatments').select('*').order('name');
    setTreatments(data || []);
    setLoading(false);
  };

  const handleEdit = (t) => {
    setCurrentTreatment(t);
    setFormData({
      name: t.name || '',
      single_price: t.single_price || '',
      duration_minutes: t.duration_minutes || '',
      description: t.description || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleNew = () => {
    setCurrentTreatment(null);
    setFormData({ name: '', single_price: '', duration_minutes: '', description: '' });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('請輸入療程名稱');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      business_id: '00000000-0000-0000-0000-000000000001',
      name: formData.name.trim(),
      single_price: parseFloat(formData.single_price) || 0,
      duration_minutes: parseInt(formData.duration_minutes) || 60,
      description: formData.description.trim(),
      is_active: true,
    };

    let result;
    if (currentTreatment) {
      result = await supabase.from('treatments').update(payload).eq('id', currentTreatment.id);
    } else {
      result = await supabase.from('treatments').insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setShowModal(false);
      fetchTreatments();
    }
    setSaving(false);
  };

  // 🛡️ 三層防禦：檢查關聯數據
  const checkDependencies = async (t) => {
    setCheckingDeps(true);
    try {
      const [
        { count: activeServicesCount },
        { count: totalAppointmentsCount },
        { count: totalTransactionsCount },
      ] = await Promise.all([
        supabase.from('client_services')
          .select('id', { count: 'exact', head: true })
          .eq('treatment_id', t.id)
          .gt('remaining_sessions', 0),
        supabase.from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('treatment_id', t.id),
        supabase.from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('treatment_id', t.id),
      ]);

      setDeleteDeps({
        treatment: t,
        activeServices: activeServicesCount || 0,
        totalAppointments: totalAppointmentsCount || 0,
        totalTransactions: totalTransactionsCount || 0,
      });
      setShowDeleteConfirm(t);
    } catch (err) {
      console.warn('checkDependencies error:', err.message);
      setDeleteDeps({
        treatment: t,
        activeServices: 0,
        totalAppointments: 0,
        totalTransactions: 0,
      });
      setShowDeleteConfirm(t);
    }
    setCheckingDeps(false);
  };

  // 🛡️ 執行刪除/停用
  const handleDelete = async () => {
    const deps = deleteDeps;
    if (!deps) return;
    if (deps.activeServices > 0) return;

    // 🟢 層級一：完全無使用紀錄 → 硬刪除
    if (deps.totalAppointments === 0 && deps.totalTransactions === 0) {
      await supabase.from('treatments').delete().eq('id', deps.treatment.id);
    } else {
      // 🟡 層級二：有歷史紀錄 → 軟刪除
      await supabase.from('treatments').update({ is_active: false }).eq('id', deps.treatment.id);
    }

    setShowDeleteConfirm(null);
    setDeleteDeps(null);
    fetchTreatments();
  };

  // 🟢 恢復已停用的療程
  const handleRestore = async (t) => {
    await supabase.from('treatments').update({ is_active: true }).eq('id', t.id);
    fetchTreatments();
  };

  // 判斷狀態等級
  const getStatus = (t) => {
    if (!t.is_active) return 'disabled'; // 已停用
    return 'active'; // 正常
  };

  // 根據層級產生 Modal 內容
  const getDeleteModalContent = () => {
    const deps = deleteDeps;
    if (!deps) return null;

    const { treatment, activeServices, totalAppointments, totalTransactions } = deps;

    // 🔴 層級三
    if (activeServices > 0) {
      return {
        title: '🚫 無法停用',
        icon: <ShieldExclamationIcon className="w-16 h-16 text-danger" />,
        message: (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-bold text-danger text-lg mb-2">此療程目前仍有客戶持有有效套票！</p>
              <div className="flex items-center gap-2 text-sm text-text">
                <UsersIcon className="w-5 h-5 text-danger" />
                <span><b>{activeServices}</b> 位客戶仍有剩餘次數未使用完畢</span>
              </div>
            </div>
            <div className="text-sm text-text-muted space-y-2">
              <p>為保護客戶權益及店舖合約義務，您必須先處理這些套票：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>前往每位客戶的詳情頁 → 為相關療程辦理<b>退款</b></li>
                <li>或等待客戶將剩餘次數全部使用完畢</li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-text">
              💡 <b>提示：</b>您可以在「客戶管理」中搜尋此療程名稱，找出持有此套票的客戶。
            </div>
          </div>
        ),
        confirmLabel: null, // 不顯示確認按鈕
        confirmVariant: null,
      };
    }

    // 🟢 層級一
    if (totalAppointments === 0 && totalTransactions === 0) {
      return {
        title: '🗑️ 確認刪除療程',
        icon: <CheckCircleIcon className="w-16 h-16 text-success" />,
        message: (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-bold text-success text-lg mb-2">✅ 此療程沒有任何使用紀錄</p>
              <p className="text-sm text-text">
                「<b>{treatment.name}</b>」從未被預約、購買或產生交易。系統將<b>永久刪除</b>此療程，不留下幽靈資料。
              </p>
            </div>
          </div>
        ),
        confirmLabel: '確認永久刪除',
        confirmVariant: 'danger',
      };
    }

    // 🟡 層級二
    return {
      title: '⚠️ 確認停用療程',
      icon: <ExclamationTriangleIcon className="w-16 h-16 text-warning" />,
      message: (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <p className="font-bold text-text text-lg">此療程包含歷史使用紀錄，無法永久刪除</p>
            <div className="flex items-center gap-2 text-sm text-text">
              <CalendarDaysIcon className="w-5 h-5 text-warning" />
              <span><b>{totalAppointments}</b> 筆歷史預約紀錄</span>
            </div>
            {totalTransactions > 0 && (
              <div className="flex items-center gap-2 text-sm text-text">
                <ShoppingCartIcon className="w-5 h-5 text-warning" />
                <span><b>{totalTransactions}</b> 筆財務交易紀錄</span>
              </div>
            )}
          </div>
          <p className="text-sm text-text-muted">
            為保持帳目完整性，系統將執行<b>「停用」</b>而非刪除：<br />
            • 「{treatment.name}」將從新增預約選單中隱藏<br />
            • 歷史紀錄中的療程名稱將完整保留<br />
            • 您隨時可以重新啟用此療程
          </p>
        </div>
      ),
      confirmLabel: '確認停用',
      confirmVariant: 'danger',
    };
  };

  const modalContent = getDeleteModalContent();

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text">💆 療程管理</h1>
          <p className="text-text-muted">定義美容院提供的服務項目與價格</p>
        </div>
        <Button variant="primary" icon={PlusIcon} onClick={handleNew}>
          新增療程
        </Button>
      </header>

      <div className="flex-1 min-h-0 bg-surface rounded-2xl shadow-card overflow-auto">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : treatments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <SparklesIcon className="w-16 h-16 opacity-20 mb-4" />
            <p className="text-lg">暫無療程項目</p>
            <p className="text-sm mt-2">點擊右上角「新增療程」開始建立服務項目</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-0">
              <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                <th className="px-6 py-4 font-bold">療程名稱</th>
                <th className="px-6 py-4 font-bold">建議時長 (分)</th>
                <th className="px-6 py-4 font-bold">單次價格</th>
                <th className="px-6 py-4 font-bold">狀態</th>
                <th className="px-6 py-4 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {treatments.map(t => {
                const status = getStatus(t);
                const isDisabled = status === 'disabled';
                return (
                  <tr key={t.id} className={isDisabled ? 'opacity-60' : ''}>
                    <td className="px-6 py-4 font-bold text-text">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-primary" />
                        {t.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">{t.duration_minutes || 60} 分鐘</td>
                    <td className="px-6 py-4 text-primary font-bold">HK${(t.single_price || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {isDisabled ? (
                        <span className="inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium bg-gray-100 text-gray-500">已停用</span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium bg-green-100 text-green-700">啟用中</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(t)} className="p-2 text-info hover:bg-blue-50 rounded-lg transition-colors" title="編輯療程">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        {isDisabled ? (
                          <button
                            onClick={() => handleRestore(t)}
                            className="p-2 text-success hover:bg-green-50 rounded-lg transition-colors"
                            title="恢復啟用"
                          >
                            <ArrowUturnLeftIcon className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => checkDependencies(t)}
                            className="p-2 text-danger hover:bg-red-50 rounded-lg transition-colors"
                            title="停用／刪除療程"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 新增/編輯 Modal */}
      <Modal
        show={showModal}
        onClose={() => setShowModal(false)}
        title={currentTreatment ? "編輯療程" : "新增療程項目"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>取消</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>儲存變更</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert color="failure">{error}</Alert>}
          <div>
            <label className="block text-sm font-medium mb-1">療程名稱</label>
            <TextInput placeholder="例如：激光脫毛 (全臉)" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">單次價格 (HKD)</label>
              <TextInput type="number" placeholder="1200" value={formData.single_price} onChange={(e) => setFormData({...formData, single_price: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">建議時長 (分鐘)</label>
              <TextInput type="number" placeholder="60" value={formData.duration_minutes} onChange={(e) => setFormData({...formData, duration_minutes: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">療程說明</label>
            <TextInput placeholder="簡單描述療程內容與注意事項..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>
        </div>
      </Modal>

      {/* 🛡️ 三層防禦停用 Modal */}
      <Modal
        show={showDeleteConfirm && !checkingDeps}
        onClose={() => { setShowDeleteConfirm(null); setDeleteDeps(null); }}
        title={modalContent?.title || '檢查中...'}
        footer={
          modalContent?.confirmLabel ? (
            <>
              <Button variant="secondary" onClick={() => { setShowDeleteConfirm(null); setDeleteDeps(null); }}>取消</Button>
              <Button variant={modalContent.confirmVariant} onClick={handleDelete}>
                {modalContent.confirmLabel}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => { setShowDeleteConfirm(null); setDeleteDeps(null); }}>
              返回列表
            </Button>
          )
        }
      >
        <div className="text-center space-y-4 py-4">
          {modalContent?.icon && (
            <div className="flex items-center justify-center">{modalContent.icon}</div>
          )}
          <div className="text-left">{modalContent?.message}</div>
        </div>
      </Modal>

      {/* Loading overlay for dependency check */}
      {checkingDeps && (
        <Modal show={true} onClose={() => {}} title="檢查中..." footer={null}>
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Spinner size="xl" />
            <p className="text-text-muted">正在檢查此療程的關聯數據...</p>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TreatmentManagePage;
