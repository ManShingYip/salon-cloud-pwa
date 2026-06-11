/**
 * AuthContext — Supabase 真實認證 + profiles 角色
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);      // profiles row
  const [session, setSession] = useState(null); // supabase auth session
  const [loading, setLoading] = useState(true); // 初始化中

  // 初始載入：檢查現有 session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 監聽登入/登出變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 從 profiles 表讀取角色
  const fetchProfile = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        console.warn('fetchProfile error:', error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setUser({
          id: data.id,
          name: data.name,
          role: data.role,
          phone: data.phone,
          business_id: data.business_id,
        });
      }
    } catch (err) {
      console.warn('fetchProfile failed:', err.message);
    }
    setLoading(false);
  };

  // 登入
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  // 登出
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isOwner = user?.role === 'shop_owner';
  const isStaff = user?.role === 'staff';

  return (
    <AuthContext.Provider value={{ user, session, loading, isOwner, isStaff, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
