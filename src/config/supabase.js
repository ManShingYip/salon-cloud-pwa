/**
 * Supabase Client 初始化
 *
 * 環境變數需在 Vercel Dashboard 或 .env.local 中設定：
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-key>
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'
);
