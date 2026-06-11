/**
 * 登入頁面 — 店長 & 員工統一入口
 */
import React, { useState } from 'react';
import { Alert } from 'flowbite-react';
import { LockClosedIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';

const LoginPage = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('請輸入 Email 及密碼');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? '帳號或密碼錯誤'
        : err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">💆</span>
          </div>
          <h1 className="text-3xl font-bold text-text">Salon Cloud</h1>
          <p className="text-text-muted mt-2">美容院雲端管理系統</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-8 shadow-card space-y-6">
          <h2 className="text-xl font-bold text-center">登入</h2>

          {error && (
            <Alert color="failure" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <EnvelopeIcon className="w-5 h-5 text-text-muted" />
              </div>
              <input
                type="email"
                placeholder="boss@salon.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-surface border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-base w-full min-h-[48px] focus:border-primary focus:ring-2 focus:ring-primary-light outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">密碼</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <LockClosedIcon className="w-5 h-5 text-text-muted" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-surface border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-base w-full min-h-[48px] focus:border-primary focus:ring-2 focus:ring-primary-light outline-none"
              />
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={submitting}
            onClick={handleSubmit}
          >
            登入
          </Button>

          <p className="text-xs text-text-muted text-center">
            僅限店長及已授權員工使用
          </p>
        </form>

        <p className="text-center text-xs text-text-muted mt-6">
          Salon Cloud v1.0 · Powered by Supabase
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
