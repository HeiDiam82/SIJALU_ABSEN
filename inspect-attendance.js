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

async function inspectAttendance() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const supabase = createClient(url, key);

  console.log('Updating attendance_id = 1 coordinates...');
  const { data: updateData, error: updateErr } = await supabase
    .from('attendance')
    .update({ koordinat_gps: '(110.3789, -7.7956)' })
    .eq('attendance_id', 1)
    .select();

  if (updateErr) {
    console.error('Update failed:', updateErr.message);
  } else {
    console.log('Update Successful. Output record:');
    console.dir(updateData, { depth: null });
    console.log('Type of koordinat_gps:', typeof updateData[0].koordinat_gps);
  }
}

inspectAttendance();
