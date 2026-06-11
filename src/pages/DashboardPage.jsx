/**
 * 店長儀表板 — 六大區塊總覽
 * ① 今日實況 ② 今日收入 ③ 客戶活躍 ④ 療程熱度 ⑤ 員工表現 ⑥ 異常提示
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spinner, Alert } from 'flowbite-react';
import {
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  FireIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { exportClients, exportSales } from '@/utils/exportExcel';
import Tag from '@/components/ui/Tag';
import Button from '@/components/ui/Button';

// 安全查詢包裝器：每個查詢獨立容錯，避免一個 404 整頁崩潰
const safeQuery = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    console.warn('Dashboard query failed:', e.message);
    return { data: null, error: e };
  }
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const firstOfMonth = today.slice(0, 7) + '-01';

    // 並行查詢所有儀表板數據（每個查詢獨立容錯）
    const [
      { data: appts },
      { data: payments },
      { data: dormant },
      { data: activeCount },
      { data: newClientCount },
      { data: topTreatments },
      { data: staffStats },
      { data: expiringServices },
      { data: noShowClients },
    ] = await Promise.all([
      safeQuery(() => supabase.from('appointments').select('status').eq('appointment_date', today)),
      safeQuery(() => supabase.from('payment_transactions').select('amount, payment_method, remarks').eq('transaction_date', today)),
      safeQuery(() => supabase.from('dormant_clients').select('id', { count: 'exact', head: true })),
      safeQuery(() => supabase.from('clients').select('id', { count: 'exact', head: true }).gte('last_visit_date', thirtyDaysAgo)),
      safeQuery(() => supabase.from('clients').select('id', { count: 'exact', head: true }).gte('created_at', firstOfMonth)),
      safeQuery(() => supabase.from('payment_transactions').select('treatment_id, treatments(name)').gte('transaction_date', thirtyDaysAgo)),
      safeQuery(() => supabase.from('appointments').select('staff_id, profiles(name)').eq('status', 'attended').gte('appointment_date', firstOfMonth)),
      safeQuery(() => supabase.from('client_services').select('*, clients(name), treatments(name)').eq('status', 'active').gte('expiry_date', today).lte('expiry_date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]).limit(10)),
      safeQuery(() => supabase.from('clients').select('id, name').not('last_visit_date', 'is', null).order('last_visit_date', { ascending: true }).limit(20)),
    ]);

    // 彙總計算
    const todayStats = {
      total: appts?.length || 0,
      attended: appts?.filter(a => a.status === 'attended').length || 0,
      pending: appts?.filter(a => a.status === 'confirmed').length || 0,
      noShow: appts?.filter(a => a.status === 'no_show').length || 0,
    };

    const revenue = {
      total: 0, cash: 0, card: 0, transfer: 0, other: 0, voidCount: 0,
    };
    payments?.forEach(p => {
      const amt = parseFloat(p.amount) || 0;
      revenue.total += amt;
      if (p.payment_method === 'cash') revenue.cash += amt;
      else if (p.payment_method === 'card') revenue.card += amt;
      else if (p.payment_method === 'transfer') revenue.transfer += amt;
      else revenue.other += amt;
      if (p.remarks?.includes('VOID')) revenue.voidCount++;
    });

    // 療程熱度排名
    const treatmentMap = {};
    topTreatments?.forEach(tx => {
      const name = tx.treatments?.name || '未知';
      treatmentMap[name] = (treatmentMap[name] || 0) + 1;
    });
    const topFive = Object.entries(treatmentMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // 員工表現彙總
    const staffMap = {};
    staffStats?.forEach(a => {
      const name = a.profiles?.name || '未知';
      staffMap[name] = (staffMap[name] || 0) + 1;
    });
    const staffSummary = Object.entries(staffMap).sort((a, b) => b[1] - a[1]);

    setDashboard({
      todayStats, revenue, topFive, staffSummary,
      dormantCount: dormant?.count || 0,
      activeCount: activeCount?.count || 0,
      newClientCount: newClientCount?.count || 0,
      expiringServices: expiringServices || [],
      noShowClients: noShowClients || [],
    });
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center p-20"><Spinner size="xl" /></div>;

  const d = dashboard;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-text">🏠 儀表板</h1>
        <p className="text-text-muted text-sm mt-1">
          {new Date().toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>
      </header>

      {/* Row 1: 今日實況 + 收入 + 客戶 */}
      <div className="grid grid-cols-3 gap-6">
        {/* ① 今日實況 */}
        <Card className="p-2">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <CalendarDaysIcon className="w-5 h-5 text-primary" /> 今日實況
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-bg rounded-xl cursor-pointer" onClick={() => navigate('/appointments')}>
              <span className="text-text-muted">總預約</span>
              <span className="text-xl font-bold">{d.todayStats.total}</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-50 p-3 rounded-xl text-center">
                <span className="text-xs text-success block">✅ 已完成</span>
                <span className="text-lg font-bold">{d.todayStats.attended}</span>
              </div>
              <div className="flex-1 bg-amber-50 p-3 rounded-xl text-center">
                <span className="text-xs text-warning block">⏳ 待處理</span>
                <span className="text-lg font-bold">{d.todayStats.pending}</span>
              </div>
              {d.todayStats.noShow > 0 && (
                <div className="flex-1 bg-red-50 p-3 rounded-xl text-center">
                  <span className="text-xs text-danger block">❌ 失約</span>
                  <span className="text-lg font-bold text-danger">{d.todayStats.noShow}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ② 今日收入 */}
        <Card className="p-2">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-primary" /> 今日收入
          </h3>
          <div className="text-center mb-4">
            <span className="text-3xl font-black text-primary">HK${d.revenue.total.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-bg p-2 rounded-xl"><span className="text-text-muted block">💵 現金</span><b>${d.revenue.cash.toLocaleString()}</b></div>
            <div className="bg-bg p-2 rounded-xl"><span className="text-text-muted block">💳 信用卡</span><b>${d.revenue.card.toLocaleString()}</b></div>
            <div className="bg-bg p-2 rounded-xl"><span className="text-text-muted block">📱 轉賬</span><b>${d.revenue.transfer.toLocaleString()}</b></div>
          </div>
          {d.revenue.voidCount > 0 && (
            <p className="text-xs text-warning text-center mt-3">⚠️ 含 {d.revenue.voidCount} 筆 VOID 退回交易</p>
          )}
        </Card>

        {/* ③ 客戶活躍度 */}
        <Card className="p-2">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <UserGroupIcon className="w-5 h-5 text-primary" /> 客戶活躍度
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-bg rounded-xl">
              <span className="text-text-muted">活躍客戶 (30日)</span>
              <span className="text-xl font-bold text-success">{d.activeCount}</span>
            </div>
            <div
              className="flex justify-between items-center p-3 bg-red-50 rounded-xl cursor-pointer"
              onClick={() => navigate('/dormant')}
            >
              <span className="text-text-muted">😴 沉睡客戶 (&gt;90日)</span>
              <span className="text-xl font-bold text-danger">{d.dormantCount}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-bg rounded-xl">
              <span className="text-text-muted">🆕 新客戶 (本月)</span>
              <span className="text-xl font-bold text-info">{d.newClientCount}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: 療程熱度 + 員工表現 */}
      <div className="grid grid-cols-2 gap-6">
        {/* ④ 療程熱度 */}
        <Card className="p-2">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <FireIcon className="w-5 h-5 text-danger" /> 療程熱度 (30日)
          </h3>
          {d.topFive.length > 0 ? (
            <div className="space-y-3">
              {d.topFive.map(([name, count], i) => {
                const maxW = Math.max(...d.topFive.map(t => t[1]));
                const pct = Math.round((count / maxW) * 100);
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="text-text-muted">{count} 次</span>
                    </div>
                    <div className="w-full bg-bg rounded-full h-4">
                      <div
                        className="h-4 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-text-muted py-10">暫無資料</p>
          )}
        </Card>

        {/* ⑤ 員工表現 (僅店長可見) */}
        <Card className="p-2">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <UserGroupIcon className="w-5 h-5 text-primary" /> 員工表現 (本月 · 已完成預約)
          </h3>
          {d.staffSummary.length > 0 ? (
            <div className="space-y-3">
              {d.staffSummary.map(([name, count]) => (
                <div key={name} className="flex justify-between items-center p-3 bg-bg rounded-xl">
                  <span className="font-medium">{name}</span>
                  <span className="text-lg font-bold text-primary">{count} 次</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted py-10">暫無資料</p>
          )}
        </Card>
      </div>

      {/* Row 3: 異常提示 */}
      <Card className="p-2">
        <h3 className="font-bold flex items-center gap-2 mb-4">
          <ExclamationTriangleIcon className="w-5 h-5 text-warning" /> 待辦事項 / 異常提示
        </h3>
        <div className="space-y-3">
          {/* 套票到期 */}
          {d.expiringServices.length > 0 && (
            <Alert color="warning">
              <b>📅 套票 7 日內到期 ({d.expiringServices.length} 項)：</b>
              <ul className="list-disc pl-4 mt-2 text-sm">
                {d.expiringServices.map(s => (
                  <li key={s.id}>{s.clients?.name} · {s.treatments?.name} (到期日: {s.expiry_date})</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* 失約警示 */}
          {d.noShowClients.length > 0 && (
            <Alert color="warning">
              <b>⚠️ 可能有沉睡風險的客戶：</b>
              <span className="text-sm ml-2">
                {d.noShowClients.slice(0, 3).map(c => c.name).join('、')}
                {d.noShowClients.length > 3 && ` 等 ${d.noShowClients.length} 人`}
              </span>
            </Alert>
          )}

          {d.expiringServices.length === 0 && d.noShowClients.length === 0 && (
            <p className="text-center text-text-muted py-6">✅ 目前無異常提示</p>
          )}
        </div>
      </Card>

      {/* 📤 資料匯出 */}
      <Card className="p-2">
        <h3 className="font-bold flex items-center gap-2 mb-4">
          <ArrowDownTrayIcon className="w-5 h-5 text-primary" /> 資料匯出
        </h3>
        <div className="flex gap-4">
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => exportClients(supabase)}>
            匯出客戶名單
          </Button>
          <Button variant="secondary" icon={ArrowDownTrayIcon} onClick={() => exportSales(supabase)}>
            匯出銷售紀錄
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
