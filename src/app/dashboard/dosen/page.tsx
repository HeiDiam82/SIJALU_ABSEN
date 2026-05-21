'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { 
  Plus, 
  Clock, 
  QrCode, 
  MapPin, 
  UserCheck, 
  Users, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle,
  FileSpreadsheet,
  AlertTriangle,
  Play,
  StopCircle
} from 'lucide-react';

interface ScheduleItem {
  schedule_id: string;
  course_id: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  ruangan: string;
  course: {
    name: string;
    sks: number;
  };
}

interface ActiveSession {
  session_id: string;
  schedule_id: string;
  qr_code_token: string;
  unique_code: string;
  expiry_time: string;
  course_name: string;
  ruangan: string;
}

interface StudentAttendance {
  attendance_id: number;
  timestamp: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  koordinat_gps: { x: number; y: number } | string | null;
  id_user_mahasiswa: string;
  mahasiswa: {
    nim: string;
    prodi: string;
    users: {
      nama: string;
    };
  };
}

export default function DosenDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [attendanceList, setAttendanceList] = useState<StudentAttendance[]>([]);
  
  // Form states
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [duration, setDuration] = useState('15'); // default 15 minutes
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Realtime active status
  const [countdown, setCountdown] = useState<string>('');

  // Students list
  const [studentsList, setStudentsList] = useState<{ id_user: string; nim: string; nama: string; prodi: string }[]>([]);

  // 1. Initial Data Load
  useEffect(() => {
    const initDosen = async () => {
      setLoading(true);
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) {
        router.push('/');
        return;
      }

      // Fetch Lecturer Schedules
      const { data: scheduleData } = await supabase
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
        .eq('id_user_dosen', authSession.user.id);

      if (scheduleData) {
        setSchedules(scheduleData as unknown as ScheduleItem[]);
        if (scheduleData.length > 0) {
          setSelectedSchedule(scheduleData[0].schedule_id);
        }
      }

      // Fetch all students in the database
      const { data: allStudents } = await supabase
        .from('mahasiswa')
        .select(`
          id_user,
          nim,
          prodi,
          users (nama)
        `);

      if (allStudents) {
        setStudentsList(
          allStudents.map((m: any) => ({
            id_user: m.id_user,
            nim: m.nim,
            prodi: m.prodi,
            nama: m.users?.nama || 'Unknown'
          }))
        );
      }

      setLoading(false);
    };

    initDosen();
  }, [router]);

  // 1.5. Fetch Session and Attendance when Selected Schedule changes
  const loadSessionAndAttendanceForSchedule = async (scheduleId: string) => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) return;

      // Check if there is an active session for this specific schedule
      const { data: sessionData, error: sessionErr } = await supabase
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
        .eq('schedule_id', scheduleId)
        .gt('expiry_time', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionErr) {
        console.error('Session query error:', sessionErr);
      }

      if (sessionData) {
        const formattedSession: ActiveSession = {
          session_id: sessionData.session_id,
          schedule_id: sessionData.schedule_id,
          qr_code_token: sessionData.qr_code_token,
          unique_code: sessionData.unique_code,
          expiry_time: sessionData.expiry_time,
          course_name: (sessionData.schedule as any).course.name,
          ruangan: (sessionData.schedule as any).ruangan
        };
        setActiveSession(formattedSession);
        fetchAttendance(formattedSession.session_id);
      } else {
        setActiveSession(null);
        setAttendanceList([]);
      }
    } catch (err) {
      console.error('Error checking active session:', err);
    }
  };

  useEffect(() => {
    if (selectedSchedule) {
      loadSessionAndAttendanceForSchedule(selectedSchedule);
    }
  }, [selectedSchedule]);

  // 2. Hydrate Attendance Lists for Session
  const fetchAttendance = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        attendance_id,
        timestamp,
        status,
        koordinat_gps,
        id_user_mahasiswa,
        mahasiswa (
          nim,
          prodi,
          users (nama)
        )
      `)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Fetch attendance error:', error);
    } else if (data) {
      setAttendanceList(data as unknown as StudentAttendance[]);
    }
  };

  // 3. Realtime Subscription Setup
  useEffect(() => {
    if (!activeSession) return;

    // Listen to INSERT/UPDATE/DELETE events in the attendance table for this session
    const channel = supabase
      .channel(`attendance-updates-${activeSession.session_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `session_id=eq.${activeSession.session_id}`
        },
        () => {
          // Re-fetch attendance records to keep UI fully populated
          fetchAttendance(activeSession.session_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession]);

  // 4. Expiry Countdown Clock
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      const difference = +new Date(activeSession.expiry_time) - +new Date();
      if (difference <= 0) {
        setActiveSession(null);
        setAttendanceList([]);
        clearInterval(interval);
      } else {
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // 5. Generate Session Handler
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) {
      setErrorMsg('Silakan pilih jadwal kuliah terlebih dahulu.');
      return;
    }
    setGenerating(true);
    setErrorMsg(null);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) {
        throw new Error('Sesi dosen habis. Silakan login kembali.');
      }

      // Generate parameters
      const qrToken = crypto.randomUUID();
      // Generate 6 digit numeric fallback code
      const pinCode = (Math.floor(Math.random() * 900000) + 100000).toString();
      
      const expiry = new Date();
      expiry.setMinutes(expiry.getMinutes() + parseInt(duration));

      // Insert session record
      const { data: insertedSession, error: insertErr } = await supabase
        .from('session')
        .insert({
          schedule_id: selectedSchedule,
          id_user_dosen: authSession.user.id,
          qr_code_token: qrToken,
          unique_code: pinCode,
          expiry_time: expiry.toISOString()
        })
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
        .single();

      if (insertErr) throw insertErr;

      const formattedSession: ActiveSession = {
        session_id: insertedSession.session_id,
        schedule_id: insertedSession.schedule_id,
        qr_code_token: insertedSession.qr_code_token,
        unique_code: insertedSession.unique_code,
        expiry_time: insertedSession.expiry_time,
        course_name: (insertedSession.schedule as any).course.name,
        ruangan: (insertedSession.schedule as any).ruangan
      };

      setActiveSession(formattedSession);
      setAttendanceList([]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat sesi presensi.');
    } finally {
      setGenerating(false);
    }
  };

  // 6. Manual Override Status Click
  const handleUpdateStatus = async (attendanceId: number, newStatus: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa') => {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus })
        .eq('attendance_id', attendanceId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // 6.2. Background Auto-Session Creation
  const handleCreateSessionInBg = async (scheduleId: string): Promise<string> => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.user) {
      throw new Error('Sesi dosen habis. Silakan login kembali.');
    }

    const qrToken = crypto.randomUUID();
    const pinCode = (Math.floor(Math.random() * 900000) + 100000).toString();
    
    // Default duration: 90 minutes
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 90);

    const { data: insertedSession, error: insertErr } = await supabase
      .from('session')
      .insert({
        schedule_id: scheduleId,
        id_user_dosen: authSession.user.id,
        qr_code_token: qrToken,
        unique_code: pinCode,
        expiry_time: expiry.toISOString()
      })
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
      .single();

    if (insertErr) throw insertErr;

    const formattedSession: ActiveSession = {
      session_id: insertedSession.session_id,
      schedule_id: insertedSession.schedule_id,
      qr_code_token: insertedSession.qr_code_token,
      unique_code: insertedSession.unique_code,
      expiry_time: insertedSession.expiry_time,
      course_name: (insertedSession.schedule as any).course.name,
      ruangan: (insertedSession.schedule as any).ruangan
    };

    setActiveSession(formattedSession);
    return insertedSession.session_id;
  };

  // 6.3. Insert Attendance for Student
  const handleInsertStatus = async (sessionId: string, studentId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa') => {
    try {
      const { error } = await supabase
        .from('attendance')
        .insert({
          session_id: sessionId,
          id_user_mahasiswa: studentId,
          status: status,
          timestamp: new Date().toISOString()
        });
      if (error) throw error;
      fetchAttendance(sessionId);
    } catch (err) {
      console.error('Failed to insert status:', err);
    }
  };

  // 6.4. Direct Button Click Handler
  const handleButtonClick = async (studentId: string, status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa') => {
    try {
      let sessionId = activeSession?.session_id;
      if (!sessionId) {
        // Auto create session in background
        sessionId = await handleCreateSessionInBg(selectedSchedule);
      }
      
      const existing = attendanceList.find(a => a.id_user_mahasiswa === studentId);
      if (existing) {
        await handleUpdateStatus(existing.attendance_id, status);
      } else {
        await handleInsertStatus(sessionId, studentId, status);
      }
    } catch (err: any) {
      console.error('Error in handleButtonClick:', err);
      alert(err.message || 'Gagal mengubah status presensi.');
    }
  };

  // 7. Force Close Session
  const handleTerminateSession = async () => {
    if (!activeSession) return;
    try {
      const { error } = await supabase
        .from('session')
        .update({ expiry_time: new Date().toISOString() })
        .eq('session_id', activeSession.session_id);

      if (error) throw error;
      setActiveSession(null);
      setAttendanceList([]);
    } catch (err) {
      console.error('Failed to close session:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Memuat Portal Dosen...</p>
        </div>
      </div>
    );
  }

  // QR URL
  // Encode JSON object containing session_id and qr_code_token
  const qrDataStr = activeSession 
    ? JSON.stringify({ session_id: activeSession.session_id, token: activeSession.qr_code_token })
    : '';
  const qrCodeUrl = activeSession 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataStr)}&bgcolor=24-24-27&color=255-255-255`
    : '';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Generator Form or Active Session Display */}
        <div className="lg:col-span-5 space-y-6">
          <h2 className="text-xl font-black text-white tracking-wide uppercase">
            Kontrol Sesi Presensi
          </h2>

          {!activeSession ? (
            /* SESSION GENERATOR FORM */
            <div className="glass p-6 rounded-2xl border border-zinc-900 space-y-6">
              <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
                <div className="h-10 w-10 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Buka Kelas Baru</h3>
                  <p className="text-xs text-zinc-400">Buat token presensi kelas aktif</p>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4.5 w-4.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {schedules.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-10 w-10 text-yellow-500/80 mx-auto mb-3" />
                  <p className="text-xs text-zinc-400">
                    Anda tidak memiliki jadwal mengajar terdaftar di sistem.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                      Pilih Mata Kuliah & Jadwal
                    </label>
                    <select
                      value={selectedSchedule}
                      onChange={(e) => setSelectedSchedule(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    >
                      {schedules.map((item) => (
                        <option key={item.schedule_id} value={item.schedule_id}>
                          {item.course?.name} ({item.hari}, {item.waktu_mulai.substring(0, 5)} @ {item.ruangan})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                      Masa Berlaku Presensi (Menit)
                    </label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    >
                      <option value="5">5 Menit (Ekspres)</option>
                      <option value="10">10 Menit</option>
                      <option value="15">15 Menit</option>
                      <option value="30">30 Menit</option>
                      <option value="60">60 Menit</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={generating}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 glow-primary disabled:opacity-50 cursor-pointer"
                  >
                    {generating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-4 w-4 shrink-0" />
                        Tampilkan QR Kelas
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ACTIVE SESSION CARD WITH QR & CODE */
            <div className="glass p-6 rounded-2xl border border-zinc-800/80 space-y-6 text-center relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
                Kelas Aktif
              </div>

              <div className="text-left space-y-1.5 border-b border-zinc-900 pb-4">
                <h3 className="text-base font-extrabold text-white leading-tight">
                  {activeSession.course_name}
                </h3>
                <p className="text-xs text-zinc-400 font-medium">Ruang: {activeSession.ruangan}</p>
              </div>

              {/* Generated QR Code Display */}
              <div className="bg-zinc-900/60 p-4 rounded-xl max-w-[240px] mx-auto border border-zinc-900 flex items-center justify-center glow-primary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={qrCodeUrl} 
                  alt="QR Attendance Code" 
                  className="w-full aspect-square rounded-lg shadow-md border border-zinc-800"
                />
              </div>

              {/* Pin code fallback & Timer grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-900 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">PIN Alternatif</span>
                  <span className="text-2xl font-black font-mono text-violet-400 mt-1 block tracking-widest">{activeSession.unique_code}</span>
                </div>
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-900 text-center">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block">Sisa Waktu</span>
                  <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block tracking-wide flex items-center justify-center gap-1">
                    <Clock className="h-4.5 w-4.5 shrink-0" />
                    {countdown}
                  </span>
                </div>
              </div>

              <button
                onClick={handleTerminateSession}
                className="w-full py-3 bg-red-950/40 border border-red-500/20 hover:bg-red-950/70 text-red-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <StopCircle className="h-4.5 w-4.5" />
                Tutup Kelas Sekarang
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Real-time Student Attendance Roster */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Header Stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
              <Users className="h-5.5 w-5.5 text-violet-400" />
              Daftar Presensi Mahasiswa
            </h2>
            
            <div className="flex flex-wrap gap-2">
              <div className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300">
                Total Mahasiswa: <span className="font-bold text-violet-400">{studentsList.length}</span>
              </div>
              {activeSession && (
                <>
                  <div className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300">
                    Hadir: <span className="font-bold text-emerald-400">
                      {attendanceList.filter(a => a.status === 'Hadir').length}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300">
                    Izin/Sakit: <span className="font-bold text-amber-400">
                      {attendanceList.filter(a => a.status === 'Izin' || a.status === 'Sakit').length}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl border border-zinc-800/80 overflow-hidden">
            {!activeSession && (
              <div className="p-4 bg-violet-950/20 border-b border-zinc-900 text-xs text-violet-400 flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-violet-400 shrink-0 animate-pulse" />
                <span>Sesi presensi belum aktif. Klik tombol status (**H/I/S/A**) pada mahasiswa untuk memulai presensi manual secara instan, atau buka QR Kelas di panel kiri.</span>
              </div>
            )}

            {studentsList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="h-12 w-12 bg-zinc-900/60 border border-zinc-805 text-zinc-500 rounded-full flex items-center justify-center mx-auto">
                  <Users className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-zinc-300">Belum Ada Mahasiswa</h4>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Tidak ada data mahasiswa terdaftar di sistem.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Mahasiswa</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Waktu Check-in</th>
                      <th className="p-4">Aksi Presensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {studentsList.map((student) => {
                      const row = attendanceList.find(a => a.id_user_mahasiswa === student.id_user);
                      return (
                        <tr 
                          key={student.id_user} 
                          className="hover:bg-zinc-900/40 transition-colors animate-fadeIn"
                        >
                          <td className="p-4">
                            <div className="font-bold text-white">{student.nama}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                              {student.nim} • {student.prodi}
                            </div>
                          </td>
                          <td className="p-4">
                            {row ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                row.status === 'Hadir' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : row.status === 'Izin' 
                                    ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                                    : row.status === 'Sakit' 
                                      ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' 
                                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                {row.status}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-zinc-900/60 border-zinc-900 text-zinc-500">
                                Belum Presensi
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-[10px] text-zinc-400">
                            {row ? (
                              <div className="flex items-center gap-1.5">
                                {new Date(row.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                {row.koordinat_gps && (
                                  <span className="h-4.5 w-4.5 rounded bg-zinc-950 border border-zinc-850 flex items-center justify-center text-emerald-400" title="GPS Terverifikasi">
                                    <MapPin className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-600">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as const).map((status) => {
                                const isCurrent = row ? row.status === status : false;
                                let activeClass = '';
                                if (isCurrent) {
                                  if (status === 'Hadir') activeClass = 'bg-emerald-500 border-emerald-400 text-white font-black';
                                  else if (status === 'Izin') activeClass = 'bg-sky-500 border-sky-400 text-white font-black';
                                  else if (status === 'Sakit') activeClass = 'bg-yellow-500 border-yellow-400 text-white font-black';
                                  else if (status === 'Alpa') activeClass = 'bg-rose-500 border-rose-400 text-white font-black';
                                } else {
                                  activeClass = 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-white';
                                }

                                return (
                                  <button
                                    key={status}
                                    onClick={() => handleButtonClick(student.id_user, status)}
                                    className={`h-6 px-2.5 rounded font-bold uppercase text-[9px] transition-all border cursor-pointer ${activeClass}`}
                                    title={`Tandai ${status}`}
                                  >
                                    {status === 'Hadir' ? 'H' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : 'A'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
