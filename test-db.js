const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Helper to load env variables from .env.local
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

async function runTests() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  console.log('Connecting to Supabase at:', url);
  console.log('Using API key:', key ? key.substring(0, 15) + '...' : 'undefined');
  
  if (!url || !key) {
    console.error('Error: URL or API Key is missing in env!');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const tables = ['users', 'mahasiswa', 'dosen', 'admin', 'course', 'schedule', 'session', 'attendance'];

  console.log('\n--- 1. Testing simple queries on each table ---');
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table "${table}": Error ->`, error.message, `(Code: ${error.code})`);
      } else {
        console.log(`✅ Table "${table}": Success (Returned ${data.length} rows)`);
      }
    } catch (err) {
      console.log(`❌ Table "${table}": System Exception ->`, err.message);
    }
  }

  console.log('\n--- 2. Testing relation joins ---');

  // Test 2a: mahasiswa to users
  try {
    const { data, error } = await supabase.from('mahasiswa').select('id_user, nim, users(nama, email)').limit(1);
    if (error) {
      console.log('❌ Relation [mahasiswa -> users]: Error ->', error.message);
    } else {
      console.log('✅ Relation [mahasiswa -> users]: Success');
    }
  } catch (err) {
    console.log('❌ Relation [mahasiswa -> users]: Exception ->', err.message);
  }

  // Test 2b: schedule to course & dosen
  try {
    const { data, error } = await supabase.from('schedule').select('schedule_id, course(name), dosen(users(nama))').limit(1);
    if (error) {
      console.log('❌ Relation [schedule -> course & dosen]: Error ->', error.message);
    } else {
      console.log('✅ Relation [schedule -> course & dosen]: Success');
    }
  } catch (err) {
    console.log('❌ Relation [schedule -> course & dosen]: Exception ->', err.message);
  }

  // Test 2c: session to schedule
  try {
    const { data, error } = await supabase.from('session').select('session_id, schedule(ruangan, course(name))').limit(1);
    if (error) {
      console.log('❌ Relation [session -> schedule -> course]: Error ->', error.message);
    } else {
      console.log('✅ Relation [session -> schedule -> course]: Success');
    }
  } catch (err) {
    console.log('❌ Relation [session -> schedule -> course]: Exception ->', err.message);
  }
}

runTests();
