'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { 
  GraduationCap, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  QrCode,
  TrendingUp,
  FileText
} from 'lucide-react';
import Link from 'next/link';

interface StudentProfile {
  nama: string;
  nim: string;
  prodi: string;
}

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
  dosen: {
    users: {
      nama: string;
    };
  };
}

interface AttendanceLog {
  attendance_id: number;
  timestamp: string;
  status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
  koordinat_gps: { x: number; y: number } | string | null;
  session: {
    session_id: string;
    schedule: {
      course: {
        name: string;
      };
      ruangan: string;
    };
  };
}

export default function MahasiswaDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpa: 0,
    percentage: 0
  });
  const [missingAlert, setMissingAlert] = useState<{ course_name: string; ruangan: string } | null>(null);

  useEffect(() => {
    const checkReminders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        
        const res = await fetch('/api/notifications');
        const data = await res.json();
        
        if (data.active && data.reminders) {
          for (const rem of data.reminders) {
            const isMissing = rem.students.some((s: any) => s.id_user === session.user.id);
            if (isMissing) {
              setMissingAlert({
                course_name: rem.course_name,
                ruangan: rem.ruangan
              });
              break;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load reminders:', e);
      }
    };
    
    checkReminders();
  }, []);

  useEffect(() => {
    const initDashboard = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }

      // 1. Fetch profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('nama')
        .eq('id_user', session.user.id)
        .single();

      const { data: mhsProfile } = await supabase
        .from('mahasiswa')
        .select('nim, prodi')
        .eq('id_user', session.user.id)
        .single();

      if (userProfile && mhsProfile) {
        setProfile({
          nama: userProfile.nama,
          nim: mhsProfile.nim,
          prodi: mhsProfile.prodi
        });
      }

      // 2. Fetch Weekly Schedules
      const { data: scheduleData } = await supabase
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

      if (scheduleData) {
        setSchedules(scheduleData as unknown as ScheduleItem[]);
      }

      // 3. Fetch Attendance History Logs
      const { data: attendanceData } = await supabase
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
        .eq('id_user_mahasiswa', session.user.id)
        .order('timestamp', { ascending: false });

      if (attendanceData) {
        const formattedLogs = attendanceData as unknown as AttendanceLog[];
        setLogs(formattedLogs);

        // 4. Calculate Stats
        const total = formattedLogs.length;
        const hadir = formattedLogs.filter(l => l.status === 'Hadir').length;
        const izin = formattedLogs.filter(l => l.status === 'Izin').length;
        const sakit = formattedLogs.filter(l => l.status === 'Sakit').length;
        const alpa = formattedLogs.filter(l => l.status === 'Alpa').length;
        const percentage = total > 0 ? Math.round((hadir / total) * 100) : 0;

        setStats({ total, hadir, izin, sakit, alpa, percentage });
      }

      setLoading(false);
    };

    initDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Memuat Portal Mahasiswa...</p>
        </div>
      </div>
    );
  }

  // Group schedules by day
  const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const sortedSchedules = [...schedules].sort((a, b) => {
    return daysOrder.indexOf(a.hari) - daysOrder.indexOf(b.hari);
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-6 pb-24">
        
        {/* Active Class Check-in Warning Banner */}
        {missingAlert && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-2xl flex flex-col gap-3 relative overflow-hidden animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 mt-1.5 animate-ping shrink-0" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-rose-450">Peringatan Presensi</span>
                <p className="text-xs mt-1 leading-relaxed">
                  Kelas <span className="font-bold text-white">{missingAlert.course_name}</span> sedang berlangsung di ruang <span className="font-bold text-white">{missingAlert.ruangan}</span>. Anda belum check-in!
                </p>
              </div>
            </div>
            <Link 
              href="/dashboard/mahasiswa/scan"
              className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-center text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Presensi Sekarang
            </Link>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-violet-900/30 to-indigo-900/10 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute right-[-20px] bottom-[-20px] text-zinc-800/20 pointer-events-none">
            <GraduationCap className="h-32 w-32" />
          </div>
          <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shrink-0">
            <GraduationCap className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-violet-300 font-semibold tracking-wider uppercase">Selamat Datang,</p>
            <h2 className="text-xl font-bold text-white leading-tight">{profile?.nama}</h2>
            <p className="text-xs text-zinc-400 font-mono mt-1">{profile?.nim} • {profile?.prodi}</p>
          </div>
        </div>

        {/* Stats Circle Card */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-violet-400" />
                Persentase Kehadiran
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Kumulatif kehadiran kelas</p>
            </div>
            <span className="text-2xl font-black text-violet-400">{stats.percentage}%</span>
          </div>

          {/* Simple Linear Progress Bar */}
          <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden mb-5">
            <div 
              className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${stats.percentage}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-900">
              <div className="text-xs font-bold text-emerald-400">{stats.hadir}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Hadir</div>
            </div>
            <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-900">
              <div className="text-xs font-bold text-sky-400">{stats.izin}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Izin</div>
            </div>
            <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-900">
              <div className="text-xs font-bold text-yellow-400">{stats.sakit}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Sakit</div>
            </div>
            <div className="bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-900">
              <div className="text-xs font-bold text-rose-400">{stats.alpa}</div>
              <div className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Alpa</div>
            </div>
          </div>
        </div>

        {/* Primary QR Action Button */}
        <Link 
          href="/dashboard/mahasiswa/scan" 
          className="flex items-center justify-between p-4.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-2xl shadow-lg glow-primary transition-all active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <QrCode className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <h4 className="text-sm font-extrabold tracking-wide uppercase">Presensi Sekarang</h4>
              <p className="text-[11px] text-violet-200 mt-0.5">Scan kode QR atau ketik kode PIN</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-80" />
        </Link>

        {/* Swipeable Academic Calendar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-violet-400" />
              Agenda Kuliah Mingguan
            </h3>
            <span className="text-[10px] text-zinc-500 font-medium">Swipe horizontal</span>
          </div>

          {schedules.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center">
              <p className="text-xs text-zinc-400">Belum ada jadwal kuliah yang terdaftar.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x scrollbar-thin">
              {sortedSchedules.map((item) => (
                <div 
                  key={item.schedule_id} 
                  className="glass p-4 rounded-xl min-w-[240px] max-w-[240px] snap-center border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between h-36 shrink-0"
                >
                  <div>
                    <div className="flex justify-between items-start gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-violet-400 uppercase tracking-wider">
                        {item.hari}
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {item.ruangan}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-white mt-3 line-clamp-2 leading-tight">
                      {item.course?.name}
                    </h4>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2 mt-2">
                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      {item.waktu_mulai.substring(0, 5)} - {item.waktu_selesai.substring(0, 5)}
                    </div>
                    <div className="text-[9px] text-zinc-500 font-medium font-mono">
                      {item.course?.sks} SKS
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History Logs */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 px-1">
            <FileText className="h-4 w-4 text-violet-400" />
            Riwayat Kehadiran Terbaru
          </h3>

          {logs.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center">
              <p className="text-xs text-zinc-400">Belum ada riwayat presensi.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <div 
                  key={log.attendance_id} 
                  className="glass p-3.5 rounded-xl flex items-center justify-between border border-zinc-900 hover:border-zinc-800/80 transition-all"
                >
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {log.session?.schedule?.course?.name || 'Sesi Kuliah'}
                    </h4>
                    <p className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                      <span>{new Date(log.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>•</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {log.koordinat_gps && (
                      <span className="h-5 w-5 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center" title="GPS Terverifikasi">
                        <MapPin className="h-3 w-3 text-emerald-400" />
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      log.status === 'Hadir' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : log.status === 'Izin' 
                          ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                          : log.status === 'Sakit' 
                            ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
