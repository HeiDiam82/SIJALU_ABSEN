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

async function runDosenQueries() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  const dosenId = 'a2d16124-e3f8-4521-af42-2cc10771ce74'; // from query-users.js
  console.log('Testing Dosen Dashboard queries for Dosen ID:', dosenId);

  // 1. Fetch Lecturer Schedules
  console.log('1. Querying schedule...');
  const { data: scheduleData, error: schErr } = await supabase
    .from('schedule')
    .select(`
      schedule_id,
      course_id,
      hari,
      waktu_mulai,
      waktu_selesai,
      ruangan,
      course (name, sks)
    `)
    .eq('id_user_dosen', dosenId);

  if (schErr) {
    console.error('❌ Schedule query failed:', schErr.message);
  } else {
    console.log('✅ Schedule query success! Rows:', scheduleData.length);
  }

  // 2. Query active session
  console.log('2. Querying active session...');
  const { data: sessionData, error: sessErr } = await supabase
    .from('session')
    .select(`
      session_id,
      schedule_id,
      qr_code_token,
      unique_code,
      expiry_time,
      schedule (
        ruangan,
        course (name)
      )
    `)
    .eq('id_user_dosen', dosenId)
    .gt('expiry_time', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (sessErr) {
    console.error('❌ Active session query failed:', sessErr.message);
  } else {
    console.log('✅ Active session query success!');
  }

  // 3. Query attendance list for a dummy/empty session ID
  console.log('3. Querying attendance list...');
  const { data: attendanceData, error: attErr } = await supabase
    .from('attendance')
    .select(`
      attendance_id,
      timestamp,
      status,
      koordinat_gps,
      mahasiswa (
        nim,
        prodi,
        users (nama)
      )
    `)
    .eq('session_id', '00000000-0000-0000-0000-000000000000');

  if (attErr) {
    console.error('❌ Attendance list query failed:', attErr.message);
  } else {
    console.log('✅ Attendance list query success!');
  }
}

runDosenQueries();
