/**
 * ErrorBoundary — 全域錯誤攔截
 * 防止 Supabase API 錯誤直接以原始文字顯示在 UI 上
 */
import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center min-h-[60vh]">
          <div className="w-24 h-24 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-6">
            <ExclamationTriangleIcon className="w-14 h-14" />
          </div>
          <h2 className="text-2xl font-bold text-text mb-3">頁面發生錯誤</h2>
          <p className="text-text-muted text-sm mb-6 max-w-md bg-red-50 p-4 rounded-xl font-mono text-xs break-all">
            {this.state.error?.message || '未知錯誤'}
          </p>
          <div className="flex gap-4">
            <Button variant="secondary" icon={ArrowPathIcon} onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}>
              重新載入
            </Button>
            <Button variant="primary" onClick={() => window.location.href = '/'}>
              返回首頁
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
