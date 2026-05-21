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

async function testInsert() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  console.log('Testing manual insert into public.users...');
  const testId = '00000000-0000-0000-0000-' + Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  
  const { data, error } = await supabase.from('users').insert({
    id_user: testId,
    nama: 'Test User Manual',
    email: `manual_${Math.floor(Math.random() * 100000)}@gmail.com`,
    role: 'mahasiswa'
  }).select();

  if (error) {
    console.error('❌ Insert into users failed:', error.message);
    return;
  }
  
  console.log('✅ Insert into users successful! Data:', data);

  console.log('Testing manual insert into public.mahasiswa...');
  const { data: mhsData, error: mhsErr } = await supabase.from('mahasiswa').insert({
    id_user: testId,
    nim: `NIM_${Math.floor(Math.random() * 100000)}`,
    prodi: 'Informatika'
  }).select();

  if (mhsErr) {
    console.error('❌ Insert into mahasiswa failed:', mhsErr.message);
  } else {
    console.log('✅ Insert into mahasiswa successful! Data:', mhsData);
  }
}

testInsert();
