/**
 * Excel 匯出工具
 * 使用 xlsx (SheetJS) library
 */
import * as XLSX from 'xlsx';

/**
 * 匯出 JSON 資料為 Excel 並觸發下載
 * @param {Array<Object>} data - JSON 資料陣列
 * @param {string} filename - 檔名 (不含副檔名)
 * @param {string} sheetName - 工作表名稱
 */
export const downloadExcel = (data, filename = 'export', sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('沒有資料可匯出');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * 匯出客戶名單
 */
export const exportClients = async (supabase) => {
  const { data } = await supabase.from('clients').select('*').order('name');
  const rows = (data || []).map(c => ({
    '會員編號': c.member_id || '',
    '姓名': c.name,
    '電話': c.phone,
    '來源': c.source || '',
    '敏感標記': c.is_sensitive ? '是' : '否',
    '備註': c.remarks || '',
    '最後到訪': c.last_visit_date || '',
    '建立日期': c.created_at?.split('T')[0] || '',
  }));
  downloadExcel(rows, `客戶名單_${new Date().toISOString().split('T')[0]}`, '客戶名單');
};

/**
 * 匯出銷售紀錄
 */
export const exportSales = async (supabase) => {
  const { data } = await supabase
    .from('payment_transactions')
    .select('*, clients(name), treatments(name)')
    .order('transaction_date', { ascending: false })
    .limit(500);

  // Manual join: staff names
  const staffIds = [...new Set(data?.map(tx => tx.staff_id).filter(Boolean) || [])];
  let staffMap = {};
  if (staffIds.length > 0) {
    const { data: sf } = await supabase.from('profiles').select('id,name').in('id', staffIds);
    sf?.forEach(s => { staffMap[s.id] = s.name; });
  }

  const rows = (data || []).map(tx => ({
    '日期': tx.transaction_date,
    '客戶': tx.clients?.name || '',
    '療程': tx.treatments?.name || '',
    '美容師': staffMap[tx.staff_id] || '',
    '金額': tx.amount,
    '支付方式': tx.payment_method === 'cash' ? '現金' : tx.payment_method === 'card' ? '信用卡' : tx.payment_method === 'transfer' ? '轉賬' : tx.payment_method === 'other' ? '其他' : tx.payment_method,
    '備註': tx.remarks || '',
  }));
  downloadExcel(rows, `銷售紀錄_${new Date().toISOString().split('T')[0]}`, '銷售紀錄');
};
