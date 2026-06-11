/**
 * 今日預約總覽頁面 - iPad 橫向為主
 * 左側迷你日曆 + 右側預約時間線 + 底部操作按鈕
 * v2: 加入敏感 Popup、失約警告、退回按鈕
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, Spinner, Badge, Card, Alert } from 'flowbite-react';
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  PlusIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserIcon,
  SparklesIcon,
  ArrowUturnLeftIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Tag from '@/components/ui/Tag';
import DeductionModal from '@/components/treatments/DeductionModal';

const DailyAppointmentsPage = () => {
  const navigate = useNavigate();
  const { user, isOwner } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Deduction Modal State
  const [showDeduction, setShowDeduction] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // ⚠️ 敏感客戶 Popup
  const [sensitiveAlert, setSensitiveAlert] = useState(null);

  // 🔙 退回 Modal State
  const [showRevert, setShowRevert] = useState(false);
  const [revertAppointment, setRevertAppointment] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    setLoading(true);
    const today = selectedDate || new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        clients (name, phone, member_id, is_sensitive, sensitive_note),
        treatments (name),
        profiles!appointments_staff_id_fkey (name),
        rooms (name)
      `)
      .eq('appointment_date', today)
      .order('start_time', { ascending: true });

    if (!error) setAppointments(data || []);
    setLoading(false);
  };

  // 點擊預約卡片：先檢查敏感，再決定是否彈扣數
  const handleStatusChange = (app) => {
    // ⚠️ 敏感客戶 Popup 檢查
    if (app.clients?.is_sensitive) {
      setSensitiveAlert({
        clientName: app.clients.name,
        note: app.clients.sensitive_note || '此客戶被標記為特殊敏感，請在服務時特別注意。',
      });
    }
    setSelectedAppointment(app);
    setShowDeduction(true);
  };

  // 🔙 店長退回已出席
  const handleRevert = async () => {
    if (!revertReason.trim()) return;
    setReverting(true);
    const { error } = await supabase.rpc('revert_attended_to_confirmed', {
      p_appointment_id: revertAppointment.id,
      p_reason: revertReason.trim(),
    });
    if (error) {
      alert('退回失敗: ' + error.message);
    } else {
      setShowRevert(false);
      setRevertAppointment(null);
      setRevertReason('');
      fetchAppointments();
    }
    setReverting(false);
  };

  const stats = {
    total: appointments.length,
    attended: appointments.filter(a => a.status === 'attended').length,
    pending: appointments.filter(a => a.status === 'confirmed').length,
    noShow: appointments.filter(a => a.status === 'no_show').length,
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* ⚠️ 敏感客戶 Popup Alert */}
      {sensitiveAlert && (
        <Alert color="warning" icon={ExclamationTriangleIcon} onDismiss={() => setSensitiveAlert(null)}>
          <b>⚠️ 特殊敏感客戶：{sensitiveAlert.clientName}</b><br />
          {sensitiveAlert.note}
        </Alert>
      )}

      {/* 頂部搜尋欄 */}
      <header className="flex items-center gap-4 bg-surface p-4 rounded-2xl shadow-card">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput
            placeholder="搜尋客戶姓名、電話..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-primary font-bold px-4 border-l">
          <CalendarIcon className="w-6 h-6" />
          <span>{selectedDate}</span>
        </div>
      </header>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* 左側日曆與統計 */}
        <aside className="w-[280px] flex flex-col gap-6 overflow-y-auto">
          <div className="bg-surface rounded-2xl p-5 shadow-card">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              日期選擇
            </h3>
            <input
              type="date"
              className="w-full border-gray-200 rounded-xl focus:ring-primary focus:border-primary"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="bg-surface rounded-2xl p-5 shadow-card space-y-4">
            <h3 className="font-bold">今日統計</h3>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-bg p-4 rounded-xl">
                <span className="text-xs text-text-muted block">總預約</span>
                <span className="text-2xl font-bold text-primary">{stats.total}</span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-green-50 p-4 rounded-xl">
                  <span className="text-xs text-success block">已出席</span>
                  <span className="text-xl font-bold">{stats.attended}</span>
                </div>
                <div className="flex-1 bg-amber-50 p-4 rounded-xl">
                  <span className="text-xs text-warning block">待處理</span>
                  <span className="text-xl font-bold">{stats.pending}</span>
                </div>
                {stats.noShow > 0 && (
                  <div className="flex-1 bg-red-50 p-4 rounded-xl">
                    <span className="text-xs text-danger block">失約</span>
                    <span className="text-xl font-bold text-danger">{stats.noShow}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* 右側預約列表 */}
        <section className="flex-1 bg-surface rounded-2xl shadow-card overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold">預約時間線</h2>
            <Badge color="info">今日共有 {appointments.length} 個預約</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="flex justify-center py-10"><Spinner size="xl" /></div>
            ) : appointments.length > 0 ? (
              appointments.map((app) => (
                <div
                  key={app.id}
                  className={`flex gap-4 p-5 rounded-2xl border transition-all active:bg-gray-50 ${
                    app.status === 'attended' ? 'bg-gray-50 border-transparent opacity-60' :
                    app.status === 'no_show' ? 'bg-red-50/30 border-red-100' :
                    'bg-white border-gray-100'
                  }`}
                >
                  <div className="w-20 flex flex-col items-center justify-center border-r pr-4">
                    <span className="text-lg font-bold text-text">{app.start_time}</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-text">{app.clients?.name}</span>
                      {app.clients?.is_sensitive && (
                        <ExclamationTriangleIcon className="w-5 h-5 text-danger" title="特殊敏感客戶" />
                      )}
                      {/* ⚠️ 失約 2 次以上警告 */}
                      {app.no_show_count >= 2 && app.status !== 'attended' && (
                        <Tag color="rose">⚠️ 失約 {app.no_show_count} 次</Tag>
                      )}
                      <Tag color={
                        app.status === 'attended' ? 'green' :
                        app.status === 'no_show' ? 'rose' :
                        app.status === 'cancelled' ? 'gray' : 'amber'
                      }>
                        {app.status === 'attended' ? '已出席' :
                         app.status === 'no_show' ? '❌ 失約' :
                         app.status === 'cancelled' ? '已取消' : '已確認'}
                      </Tag>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
                      <span className="flex items-center gap-1">
                        <SparklesIcon className="w-4 h-4 text-primary" />
                        {app.treatments?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-4 h-4" />
                        {app.profiles?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4" />
                        {app.rooms?.name}
                      </span>
                    </div>

                    {/* 顯示備註（含退回記錄） */}
                    {app.remarks && (
                      <p className="text-xs text-text-muted italic border-t pt-1 mt-1">
                        📝 {app.remarks}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {/* 🔙 店長退回按鈕 (僅 attended 狀態 + 店長) */}
                    {app.status === 'attended' && isOwner && (
                      <Button
                        variant="secondary"
                        size="md"
                        icon={ArrowUturnLeftIcon}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevertAppointment(app);
                          setRevertReason('');
                          setShowRevert(true);
                        }}
                      >
                        退回
                      </Button>
                    )}

                    {/* 扣數區：只有 confirmed 可以點擊 */}
                    {app.status === 'confirmed' && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(app);
                        }}
                      >
                        扣數
                      </Button>
                    )}

                    {/* 取消按鈕：confirmed 且未出席 */}
                    {app.status === 'confirmed' && (
                      <button
                        className="text-xs text-text-muted hover:text-danger transition-colors flex items-center gap-1 mt-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('確定取消此預約？')) {
                            await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', app.id);
                            fetchAppointments();
                          }
                        }}
                      >
                        <XCircleIcon className="w-4 h-4" /> 取消
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <CalendarIcon className="w-16 h-16 opacity-20 mb-4" />
                <p>今日尚無預約安排</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 底部浮動操作欄 */}
      <footer className="fixed bottom-8 right-8 flex gap-4">
        <Button
          variant="secondary"
          size="lg"
          icon={BanknotesIcon}
          onClick={() => navigate('/settlement')}
        >
          快速結算
        </Button>
        <Button
          variant="primary"
          size="lg"
          icon={PlusIcon}
          onClick={() => navigate('/appointments/new')}
        >
          新增預約
        </Button>
      </footer>

      {/* Deduction Modal */}
      {selectedAppointment && (
        <DeductionModal
          show={showDeduction}
          onClose={() => { setShowDeduction(false); setSensitiveAlert(null); fetchAppointments(); }}
          appointment={selectedAppointment}
        />
      )}

      {/* 🔙 退回 Modal */}
      <Modal
        show={showRevert}
        onClose={() => setShowRevert(false)}
        title="🔙 退回已出席"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRevert(false)}>取消</Button>
            <Button variant="danger" disabled={!revertReason.trim()} loading={reverting} onClick={handleRevert}>
              確認退回
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert color="warning">
            <b>⚠️ 此操作將：</b><br />
            1. 回補已扣減的療程次數<br />
            2. 標記交易為 VOID<br />
            3. 預約狀態回到「已確認」<br />
            所有操作記錄在 activity_log 中 (不可刪除)
          </Alert>
          {revertAppointment && (
            <div className="bg-bg p-4 rounded-xl text-sm space-y-1">
              <p>客戶：<b>{revertAppointment.clients?.name}</b></p>
              <p>療程：<b>{revertAppointment.treatments?.name}</b></p>
              <p>時間：{revertAppointment.start_time}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">退回原因 (必填)</label>
            <TextInput
              placeholder="例：客戶臨時取消，已溝通"
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              className="min-h-[48px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DailyAppointmentsPage;
