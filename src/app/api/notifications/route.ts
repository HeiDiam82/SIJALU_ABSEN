import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const nowStr = new Date().toISOString();

    // 1. Get currently active sessions
    const { data: activeSessions, error: sessionErr } = await supabase
      .from('session')
      .select(`
        session_id,
        created_at,
        expiry_time,
        schedule (
          ruangan,
          course (name)
        )
      `)
      .gt('expiry_time', nowStr)
      .lt('created_at', nowStr); // Ensure session has started

    if (sessionErr) throw sessionErr;

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({
        active: false,
        message: 'Tidak ada kelas atau sesi presensi yang sedang berlangsung saat ini.',
        reminders: []
      });
    }

    const remindersList = [];

    // 2. Fetch all registered students
    const { data: allStudents, error: studentErr } = await supabase
      .from('mahasiswa')
      .select(`
        id_user,
        nim,
        users (nama, email)
      `);

    if (studentErr) throw studentErr;

    // 3. For each active session, find students who haven't checked-in yet
    for (const session of activeSessions) {
      // Get students who checked-in for this session
      const { data: attendees, error: attErr } = await supabase
        .from('attendance')
        .select('id_user_mahasiswa, status')
        .eq('session_id', session.session_id);

      if (attErr) throw attErr;

      const checkedInUserIds = new Set((attendees || []).map(a => a.id_user_mahasiswa));

      // Filter students who are missing from the checked-in list
      const missingStudents = (allStudents || [])
        .filter(student => !checkedInUserIds.has(student.id_user))
        .map(student => ({
          id_user: student.id_user,
          nama: (student.users as any)?.nama || 'Mahasiswa',
          email: (student.users as any)?.email || '',
          nim: student.nim
        }));

      if (missingStudents.length > 0) {
        remindersList.push({
          session_id: session.session_id,
          course_name: (session.schedule as any).course.name,
          ruangan: (session.schedule as any).ruangan,
          expiry_time: session.expiry_time,
          missing_count: missingStudents.length,
          students: missingStudents
        });
      }
    }

    return NextResponse.json({
      active: true,
      timestamp: nowStr,
      reminders: remindersList
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal memproses pengingat presensi.' },
      { status: 500 }
    );
  }
}
