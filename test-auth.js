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

async function runAuthTests() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !key) {
    console.error('Error: URL or API Key is missing in env!');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false
    }
  });

  const testUsers = [
    { email: 'admin@sijalu.ac.id', password: 'password123', role: 'admin' },
    { email: 'dosen@sijalu.ac.id', password: 'password123', role: 'dosen' },
    { email: 'mahasiswa@sijalu.ac.id', password: 'password123', role: 'mahasiswa' }
  ];

  console.log('--- TESTING AUTH SIGN IN AND PROFILE MATCHING ---');

  for (const user of testUsers) {
    console.log(`\nTesting login for ${user.role} (${user.email})...`);
    
    // 1. Sign in with password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });

    if (authError) {
      console.error(`❌ Sign in failed:`, authError.message);
      continue;
    }

    console.log(`✅ Sign in successful! User ID: ${authData.user.id}`);

    // Create a new client authenticated as this user to simulate their session
    const userClient = createClient(url, key, {
      auth: {
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`
        }
      }
    });

    // 2. Fetch from public.users table
    const { data: profile, error: profileErr } = await userClient
      .from('users')
      .select('*')
      .eq('id_user', authData.user.id)
      .single();

    if (profileErr) {
      console.error(`❌ Fetching public.users failed:`, profileErr.message);
    } else {
      console.log(`✅ Profile retrieved: Name="${profile.nama}", Role="${profile.role}"`);
      if (profile.role !== user.role) {
        console.error(`❌ Role mismatch! Expected "${user.role}" but got "${profile.role}"`);
      }
    }

    // 3. Fetch from role-specific table
    if (user.role === 'admin') {
      const { data: adminData, error: adminErr } = await userClient
        .from('admin')
        .select('*')
        .eq('id_user', authData.user.id)
        .single();
      
      if (adminErr) {
        console.error(`❌ Fetching public.admin failed:`, adminErr.message);
      } else {
        console.log(`✅ Admin data: ID Admin="${adminData.id_admin}"`);
      }
    } else if (user.role === 'dosen') {
      const { data: dosenData, error: dosenErr } = await userClient
        .from('dosen')
        .select('*')
        .eq('id_user', authData.user.id)
        .single();
      
      if (dosenErr) {
        console.error(`❌ Fetching public.dosen failed:`, dosenErr.message);
      } else {
        console.log(`✅ Dosen data: NIP="${dosenData.nip}", Departemen="${dosenData.departemen}"`);
      }
    } else if (user.role === 'mahasiswa') {
      const { data: mhsData, error: mhsErr } = await userClient
        .from('mahasiswa')
        .select('*')
        .eq('id_user', authData.user.id)
        .single();
      
      if (mhsErr) {
        console.error(`❌ Fetching public.mahasiswa failed:`, mhsErr.message);
      } else {
        console.log(`✅ Mahasiswa data: NIM="${mhsData.nim}", Prodi="${mhsData.prodi}"`);
      }
    }

    // 4. Test relation queries that failed previously
    if (user.role === 'mahasiswa') {
      console.log('Testing relation queries for Mahasiswa Dashboard...');
      
      // Schedule query
      const { data: scheduleData, error: schErr } = await userClient
        .from('schedule')
        .select(`
          schedule_id,
          course_id,
          hari,
          waktu_mulai,
          waktu_selesai,
          ruangan,
          course (name, sks),
          dosen (
            users (nama)
          )
        `);
      
      if (schErr) {
        console.error(`❌ Schedule query failed:`, schErr.message);
      } else {
        console.log(`✅ Schedule query success! Retrieved ${scheduleData.length} records.`);
        if (scheduleData.length > 0) {
          console.log(`   Sample Schedule: ${scheduleData[0].course.name} - ${scheduleData[0].dosen.users.nama}`);
        }
      }

      // Attendance history query
      const { data: attData, error: attErr } = await userClient
        .from('attendance')
        .select(`
          attendance_id,
          timestamp,
          status,
          koordinat_gps,
          session (
            session_id,
            schedule (
              ruangan,
              course (name)
            )
          )
        `)
        .eq('id_user_mahasiswa', authData.user.id);

      if (attErr) {
        console.error(`❌ Attendance query failed:`, attErr.message);
      } else {
        console.log(`✅ Attendance query success! Retrieved ${attData.length} records.`);
      }
    }
  }
}

runAuthTests();
