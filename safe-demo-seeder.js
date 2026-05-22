const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SHOULD_RUN = process.argv.includes('--run');

function loadEnv() {
  const envPath = '.env.local';

  if (!fs.existsSync(envPath)) {
    throw new Error('File .env.local tidak ditemukan. Isi konfigurasi Supabase terlebih dahulu.');
  }

  const env = {};
  const content = fs.readFileSync(envPath, 'utf8');

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

async function main() {
  const demoCourse = {
    course_id: 'TEST-SAFE-001',
    name: 'Mata Kuliah Demo Seeder Aman',
    sks: 1,
  };

  console.log('Safe Demo Seeder - SIJALU ABSEN');
  console.log('Data yang disiapkan:', demoCourse);

  if (!SHOULD_RUN) {
    console.log('\nMode dry-run aktif. Tidak ada data yang ditulis ke database.');
    console.log('Untuk benar-benar menjalankan insert aman, pakai: node safe-demo-seeder.js --run');
    return;
  }

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL dan Supabase anon/publishable key wajib diisi.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from('course')
    .insert(demoCourse);

  if (error) {
    if (error.code === '23505') {
      console.log('Data demo sudah ada. Seeder aman berhenti tanpa mengubah data lama.');
      return;
    }

    throw error;
  }

  console.log('Data demo berhasil ditambahkan tanpa menghapus atau mengubah data lain.');
}

main().catch((error) => {
  console.error('Seeder gagal:', error.message);
  process.exit(1);
});
