const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = '.env.local';
  if (!fs.existsSync(envPath)) {
    console.error('File .env.local not found!');
    process.exit(1);
  }
  
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      env[key] = val;
    }
  });
  return env;
}

async function inspectSchema() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  console.log('Fetching columns from database...');

  // Query PostgreSQL information_schema via RPC or raw query.
  // Wait, we don't have a custom SQL RPC by default, but we can do a select on the tables and see the keys returned!
  const tables = ['users', 'mahasiswa', 'dosen', 'admin', 'course', 'schedule', 'session', 'attendance'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table "${table}": Error ->`, error.message);
    } else {
      console.log(`✅ Table "${table}": Columns ->`, data.length > 0 ? Object.keys(data[0]) : '(empty table)');
    }
  }
}

inspectSchema();
