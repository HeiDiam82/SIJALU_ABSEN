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

async function queryUsers() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  console.log('Querying public.users...');
  const { data: users, error: err1 } = await supabase.from('users').select('*');
  if (err1) console.error('Error users:', err1.message);
  else console.log('users:', users);

  console.log('Querying public.mahasiswa...');
  const { data: mhs, error: err2 } = await supabase.from('mahasiswa').select('*');
  if (err2) console.error('Error mahasiswa:', err2.message);
  else console.log('mahasiswa:', mhs);

  console.log('Querying public.dosen...');
  const { data: dosen, error: err3 } = await supabase.from('dosen').select('*');
  if (err3) console.error('Error dosen:', err3.message);
  else console.log('dosen:', dosen);

  console.log('Querying public.admin...');
  const { data: admin, error: err4 } = await supabase.from('admin').select('*');
  if (err4) console.error('Error admin:', err4.message);
  else console.log('admin:', admin);
}

queryUsers();
