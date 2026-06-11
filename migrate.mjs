import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://delhpwshibahnsueynlg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbGhwd3NoaWJhaG5zdWV5bmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA5NDk3MywiZXhwIjoyMDk2NjcwOTczfQ.zixGf9L2srtTlHgXky_Zr0puFRyTf7_-LukK3f4Yi-Y'
);

// 加 total_price column
const { error: colErr } = await supabase.rpc('pg_exec', {
  sql: 'ALTER TABLE client_services ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2)'
});
if (colErr) {
  console.log('pg_exec error:', colErr.message);
  // fallback: try SQL via REST
  const { error: sqlErr } = await supabase.rpc('execute_sql', {
    query: 'ALTER TABLE client_services ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2);'
  });
  if (sqlErr) console.log('execute_sql error:', sqlErr.message);
  else console.log('total_price column added via execute_sql');
} else {
  console.log('total_price column added');
}

// backfill: total_price = unit_price * total_sessions WHERE total_price IS NULL
const { error: backfillErr } = await supabase
  .from('client_services')
  .update({ total_price: supabase.sql`unit_price * total_sessions` })
  .is('total_price', null);
if (backfillErr) {
  console.log('backfill error:', backfillErr.message);
  // try raw SQL update
  const { error: sqlErr2 } = await supabase.rpc('execute_sql', {
    query: "UPDATE client_services SET total_price = unit_price * total_sessions WHERE total_price IS NULL;"
  });
  if (sqlErr2) console.log('backfill sql error:', sqlErr2.message);
  else console.log('backfill done via SQL');
} else {
  console.log('backfill done');
}

console.log('Migration complete');
