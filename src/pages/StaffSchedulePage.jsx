/**
 * 員工排班設定頁面 v2 (僅店長)
 * 7 天網格 × 員工列表 + 自由新增/停用員工
 */
import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, ToggleSwitch, TextInput } from 'flowbite-react';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const StaffSchedulePage = () => {
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // 排班 Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ start_time: '10:00', end_time: '19:00', is_off: false });
  const [saving, setSaving] = useState(false);

  // 新增/編輯員工 Modal
  const [showStaff, setShowStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ id: '', name: '', is_active: true });
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: sData }, { data: schData }] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('staff_schedules').select('*').order('day_of_week'),
    ]);
    setStaff(sData || []);
    setSchedules(schData || []);
    setLoading(false);
  };

  // 取得某員工某天的排班
  const getSchedule = (staffId, day) => {
    return schedules.find(s => s.staff_id === staffId && s.day_of_week === day);
  };

  // 打開排班 Modal
  const openEdit = (staffId, day) => {
    const existing = getSchedule(staffId, day);
    setEditTarget({ staffId, day });
    setEditForm(existing
      ? { start_time: existing.start_time?.slice(0,5) || '10:00', end_time: existing.end_time?.slice(0,5) || '19:00', is_off: existing.is_off }
      : { start_time: '10:00', end_time: '19:00', is_off: false }
    );
    setShowEdit(true);
  };

  // 儲存排班
  const handleSaveSchedule = async () => {
    setSaving(true);
    const existing = getSchedule(editTarget.staffId, editTarget.day);
    if (existing) {
      await supabase.from('staff_schedules').update(editForm).eq('id', existing.id);
    } else {
      await supabase.from('staff_schedules').insert({
        staff_id: editTarget.staffId,
        day_of_week: editTarget.day,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        is_off: editForm.is_off,
      });
    }
    setShowEdit(false);
    fetchData();
    setSaving(false);
  };

  // 打開新增員工 Modal
  const openAddStaff = () => {
    setStaffForm({ id: '', name: '', is_active: true });
    setShowStaff(true);
  };

  const openEditStaff = (s) => {
    setStaffForm({ id: s.id, name: s.name, is_active: s.is_active });
    setShowStaff(true);
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name.trim()) return;
    setSavingStaff(true);
    if (staffForm.id) {
      await supabase.from('profiles').update({ name: staffForm.name.trim(), is_active: staffForm.is_active }).eq('id', staffForm.id);
    } else {
      await supabase.from('profiles').insert({ name: staffForm.name.trim(), role: 'staff', business_id: '00000000-0000-0000-0000-000000000001' });
    }
    setShowStaff(false);
    fetchData();
    setSavingStaff(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">📅 員工排班設定</h1>
          <p className="text-text-muted text-sm mt-1">管理員工、設定每週排班</p>
        </div>
        <Button variant="primary" icon={PlusIcon} onClick={openAddStaff}>新增員工</Button>
      </header>

      {/* 員工列表 */}
      {staff.length === 0 ? (
        <Alert color="info">目前沒有任何員工，請點擊「新增員工」開始。</Alert>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg">
                <th className="p-4 text-left font-bold text-text-muted w-44">員工</th>
                {DAYS.map(d => (
                  <th key={d} className="p-4 text-center font-bold text-text-muted min-w-[100px]">週{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className={`border-t border-gray-100 ${!s.is_active ? 'opacity-40' : ''}`}>
                  <td className="p-4">
                    <button className="text-left hover:text-primary transition-colors" onClick={() => openEditStaff(s)}>
                      <span className="font-bold text-text">{s.name}</span>
                      {!s.is_active && <span className="ml-2 text-xs text-danger">(已停用)</span>}
                    </button>
                  </td>
                  {DAYS.map((_, day) => {
                    const sch = getSchedule(s.id, day);
                    const isOff = sch?.is_off;
                    return (
                      <td key={day} className="p-2 text-center">
                        <button
                          className={`w-full p-3 rounded-xl text-sm transition-all font-medium min-h-[48px] ${
                            isOff
                              ? 'bg-red-50 text-danger hover:bg-red-100'
                              : sch
                                ? 'bg-green-50 text-success hover:bg-green-100'
                                : 'bg-gray-50 text-text-muted hover:bg-gray-100'
                          }`}
                          onClick={() => s.is_active && openEdit(s.id, day)}
                          disabled={!s.is_active}
                        >
                          {isOff ? '休假' : sch ? `${sch.start_time?.slice(0,5)}-${sch.end_time?.slice(0,5)}` : '未設定'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* 排班 Modal */}
      <Modal
        show={showEdit}
        onClose={() => setShowEdit(false)}
        title={`設定排班 — 週${DAYS[editTarget?.day || 0]}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>取消</Button>
            <Button variant="primary" onClick={handleSaveSchedule} loading={saving}>儲存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-bg rounded-xl">
            <span className="font-medium">全天休假</span>
            <ToggleSwitch checked={editForm.is_off} onChange={(v) => setEditForm({...editForm, is_off: v})} />
          </div>
          {!editForm.is_off && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">上班時間</label>
                <input type="time" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface focus:ring-primary focus:border-primary"
                  value={editForm.start_time} onChange={(e) => setEditForm({...editForm, start_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">下班時間</label>
                <input type="time" className="w-full border-gray-200 rounded-xl min-h-[48px] px-4 bg-surface focus:ring-primary focus:border-primary"
                  value={editForm.end_time} onChange={(e) => setEditForm({...editForm, end_time: e.target.value})} />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 新增/編輯員工 Modal */}
      <Modal
        show={showStaff}
        onClose={() => setShowStaff(false)}
        title={staffForm.id ? '編輯員工' : '新增員工'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowStaff(false)}>取消</Button>
            <Button variant="primary" onClick={handleSaveStaff} loading={savingStaff}>儲存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">姓名</label>
            <TextInput value={staffForm.name} onChange={(e) => setStaffForm({...staffForm, name: e.target.value})} placeholder="員工姓名..." />
          </div>
          {staffForm.id && (
            <div className="flex items-center justify-between p-4 bg-bg rounded-xl">
              <span className="font-medium">啟用中</span>
              <ToggleSwitch checked={staffForm.is_active} onChange={(v) => setStaffForm({...staffForm, is_active: v})} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StaffSchedulePage;
