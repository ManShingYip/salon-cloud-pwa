/**
 * 客戶列表頁面
 * 搜尋 + 列表 + 電話後四碼 + 會員編號 + 來源標籤 + 敏感標記
 * 使用原生 <table> 避免 Flowbite Table 底層 shadow div 遮蔽內容
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextInput, Spinner } from 'flowbite-react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Modal from '@/components/ui/Modal';

const ClientListPage = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', source: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async (query = '') => {
    setLoading(true);
    try {
      let req = supabase.from('clients').select('*').order('name');
      if (query.length > 0) {
        req = req.or(`name.ilike.%${query}%,phone.ilike.%${query}%`);
      }
      const { data, error } = await req;
      if (error) console.warn('fetchClients error:', error.message);
      setClients(data || []);
    } catch (err) {
      console.warn('fetchClients exception:', err.message);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearch(v);
    fetchClients(v);
  };

  const getSourceTag = (source) => {
    if (!source) return <Tag color="gray">無標記</Tag>;
    if (source.includes('IG')) return <Tag color="rose">{source}</Tag>;
    if (source.includes('朋友')) return <Tag color="green">{source}</Tag>;
    return <Tag color="blue">{source}</Tag>;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 頂部標題列 */}
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text">👥 客戶管理</h1>
          <p className="text-text-muted text-sm mt-1">
            共 {clients.length} 位客戶 · 搜尋時強制顯示電話後四碼及會員編號
          </p>
        </div>
        <Button variant="primary" icon={PlusIcon} onClick={() => setShowAdd(true)}>
          新增客戶
        </Button>
      </header>

      {/* 搜尋欄 */}
      <div className="relative shrink-0">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <TextInput
          placeholder="搜尋客戶姓名或電話..."
          className="pl-12 min-h-[48px]"
          value={search}
          onChange={handleSearch}
        />
      </div>

      {/* 客戶列表 — 原生 <table>，無 Flowbite 隱藏陰影 div */}
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex justify-center p-20"><Spinner size="xl" /></div>
        ) : clients.length > 0 ? (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-0">
                <tr className="bg-bg text-xs uppercase text-text-muted border-b border-gray-100">
                  <th className="px-6 py-4 font-bold">客戶姓名</th>
                  <th className="px-6 py-4 font-bold">電話後四碼</th>
                  <th className="px-6 py-4 font-bold">會員編號</th>
                  <th className="px-6 py-4 font-bold">來源</th>
                  <th className="px-6 py-4 font-bold">狀態</th>
                  <th className="px-6 py-4 font-bold">最後到訪</th>
                  <th className="px-6 py-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <td className="px-6 py-4 font-bold">
                      <span className="flex items-center gap-2">
                        {c.name}
                        {c.is_sensitive && (
                          <ExclamationTriangleIcon className="w-5 h-5 text-danger inline" title="特殊敏感客戶" />
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted font-mono">
                      ****{String(c.phone || '').slice(-4) || '----'}
                    </td>
                    <td className="px-6 py-4 font-mono text-primary font-bold">
                      {c.member_id || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {getSourceTag(c.source)}
                    </td>
                    <td className="px-6 py-4">
                      {c.is_sensitive ? (
                        <Tag color="amber">⚠️ 特殊敏感</Tag>
                      ) : c.last_visit_date ? (
                        <Tag color="green">活躍</Tag>
                      ) : (
                        <Tag color="gray">新客戶</Tag>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {c.last_visit_date || '尚未到訪'}
                    </td>
                    <td className="px-6 py-4">
                      <ChevronRightIcon className="w-5 h-5 text-text-muted" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-center text-text-muted">
            <div>
              <p className="text-lg">暫無客戶資料</p>
              <p className="text-sm mt-2">點擊右上角「新增客戶」開始建立客戶名單</p>
            </div>
          </div>
        )}
      </div>

      {/* 新增客戶 Modal */}
      <Modal
        show={showAdd}
        onClose={() => setShowAdd(false)}
        title="👤 新增客戶"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>取消</Button>
            <Button variant="primary" loading={saving} onClick={async () => {
              if (!newClient.name.trim() || !newClient.phone.trim()) return;
              setSaving(true);
              const { error } = await supabase.from('clients').insert({
                business_id: '00000000-0000-0000-0000-000000000001',
                name: newClient.name.trim(),
                phone: newClient.phone.trim(),
                source: newClient.source || null,
                remarks: newClient.remarks || null,
              });
              if (!error) {
                setShowAdd(false);
                setNewClient({ name: '', phone: '', source: '', remarks: '' });
                fetchClients(search);
              } else {
                alert('新增失敗: ' + error.message);
              }
              setSaving(false);
            }}>確認新增</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">姓名 *</label>
            <TextInput placeholder="客戶姓名" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">電話 *</label>
            <TextInput placeholder="例：61234567" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">來源</label>
            <TextInput placeholder="IG廣告 / 朋友介紹 / 街客..." value={newClient.source} onChange={(e) => setNewClient({...newClient, source: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">備註</label>
            <TextInput placeholder="可選" value={newClient.remarks} onChange={(e) => setNewClient({...newClient, remarks: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientListPage;
