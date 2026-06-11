/**
 * 療程管理頁面 (店長權限)
 * 列表顯示所有療程項目，支援新增與編輯
 */
import React, { useState, useEffect } from 'react';
import { Table, Badge, TextInput, Spinner, Card, Alert } from 'flowbite-react';
import { PlusIcon, PencilIcon, TrashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

const TreatmentManagePage = () => {
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentTreatment, setCurrentTreatment] = useState(null);
  const [formData, setFormData] = useState({ name: '', single_price: '', duration_minutes: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  const handleDelete = async (t) => {
    await supabase.from('treatments').update({ is_active: false }).eq('id', t.id);
    setShowDeleteConfirm(null);
    fetchTreatments();
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">💆 療程管理</h1>
          <p className="text-text-muted">定義美容院提供的服務項目與價格</p>
        </div>
        <Button variant="primary" icon={PlusIcon} onClick={handleNew}>
          新增療程
        </Button>
      </header>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : (
          <Table hoverable>
            <Table.Head className="bg-bg">
              <Table.HeadCell>療程名稱</Table.HeadCell>
              <Table.HeadCell>建議時長 (分)</Table.HeadCell>
              <Table.HeadCell>單次價格</Table.HeadCell>
              <Table.HeadCell>狀態</Table.HeadCell>
              <Table.HeadCell className="text-right">操作</Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {treatments.map(t => (
                <Table.Row key={t.id}>
                  <Table.Cell className="font-bold text-text">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-5 h-5 text-primary" />
                      {t.name}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{t.duration_minutes || 60} 分鐘</Table.Cell>
                  <Table.Cell className="text-primary font-bold">HK${(t.single_price || 0).toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    <Badge color={t.is_active ? "success" : "gray"}>{t.is_active ? '啟用中' : '已停用'}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right flex justify-end gap-2">
                    <button onClick={() => handleEdit(t)} className="p-2 text-info hover:bg-blue-50 rounded-lg transition-colors">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(t)} className="p-2 text-danger hover:bg-red-50 rounded-lg transition-colors">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Card>

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

      {/* Delete Confirmation Modal */}
      <Modal
        show={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="⚠️ 確認停用療程"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>取消</Button>
            <Button variant="danger" onClick={() => handleDelete(showDeleteConfirm)}>確認停用</Button>
          </>
        }
      >
        <div className="text-center space-y-4 py-4">
          <p className="text-text-muted">
            確定要停用療程 <b>「{showDeleteConfirm?.name}」</b> 嗎？<br/>
            停用後將無法再被選擇預約，但不影響已購買的客戶庫存。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default TreatmentManagePage;
