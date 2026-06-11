/**
 * 員工排班設定頁面 (僅店長)
 * 7 天網格 × 員工列表
 */
import React, { useState, useEffect } from 'react';
import { Card, Spinner, Alert, ToggleSwitch } from 'flowbite-react';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const StaffSchedulePage = () => {
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // 編輯 Modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ start_time: '10:00', end_time: '19:00', is_off: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: sData }, { data: schData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true),
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

  // 打開編輯 Modal
  const openEdit = (staffId, day) => {
    const existing = getSchedule(staffId, day);
    setEditTarget({ staffId, day });
    setEditForm(existing
      ? { start_time: existing.start_time, end_time: existing.end_time, is_off: existing.is_off }
      : { start_time: '10:00', end_time: '19:00', is_off: false }
    );
    setShowEdit(true);
  };

  // 儲存排班
  const handleSave = async () => {
    setSaving(true);
    const existing = getSchedule(editTarget.staffId, editTarget.day);
    if (existing) {
      await supabase.from('staff_schedules').update(editForm).eq('id', existing.id);
    } else {
      await supabase.from('staff_schedules').insert({
        staff_id: editTarget.staffId,
        day_of_week: editTarget.day,
        ...editForm,
      });
    }
    setShowEdit(false);
    fetchData();
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text">📅 員工排班設定</h1>
        <p className="text-text-muted text-sm mt-1">點擊方格即可編輯上班時間</p>
      </header>

      {staff.length === 0 ? (
        <Alert color="info">
          目前沒有活躍的使用者。請先在 Supabase Dashboard → Authentication 建立使用者，再在 SQL Editor 插入 profiles 紀錄。
        </Alert>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg">
                <th className="p-4 text-left font-bold text-text-muted w-24">員工</th>
                {DAYS.map(d => (
                  <th key={d} className="p-4 text-center font-bold text-text-muted min-w-[100px]">
                    週{d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="p-4 font-bold text-text">{s.name}</td>
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
                          onClick={() => openEdit(s.id, day)}
                        >
                          {isOff ? '休假' : sch ? `${sch.start_time}-${sch.end_time}` : '未設定'}
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

      <Modal
        show={showEdit}
        onClose={() => setShowEdit(false)}
        title={`設定排班 — 週${DAYS[editTarget?.day || 0]}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>取消</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>儲存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-bg rounded-xl">
            <span className="font-medium">全天休假</span>
            <ToggleSwitch
              checked={editForm.is_off}
              onChange={(v) => setEditForm({...editForm, is_off: v})}
            />
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
    </div>
  );
};

export default StaffSchedulePage;
