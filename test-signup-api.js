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

async function testSignUp() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  console.log('Attempting to signUp via Supabase API...');
  const testEmail = `temp_user_${Math.floor(Math.random() * 100000)}@gmail.com`;
  const randomNim = `NIM_${Math.floor(Math.random() * 100000000)}`;
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: 'password123',
    options: {
      data: {
        role: 'mahasiswa',
        nama: 'Test User API',
        nim: randomNim,
        prodi: 'Informatika'
      }
    }
  });

  if (error) {
    console.error('❌ Sign up failed:', error);
  } else {
    console.log('✅ Sign up completed!');
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

testSignUp();
