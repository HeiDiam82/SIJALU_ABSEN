'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import * as XLSX from 'xlsx';
import { 
  BarChart3, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Users, 
  Trash2, 
  Edit3, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle,
  Clock,
  Database,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface UserRecord {
  id_user: string;
  nama: string;
  email: string;
  role: 'mahasiswa' | 'dosen' | 'admin';
}

interface MahasiswaRecord extends UserRecord {
  nim: string;
  prodi: string;
}

interface DosenRecord extends UserRecord {
  nip: string;
  departemen: string;
}

interface CourseRecord {
  course_id: string;
  name: string;
  sks: number;
}

interface ScheduleRecord {
  schedule_id: string;
  course_id: string;
  id_user_dosen: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  ruangan: string;
  course?: { name: string };
  dosen?: { users: { nama: string } };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'analytics' | 'mahasiswa' | 'dosen' | 'courses' | 'schedules'>('analytics');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Database lists
  const [students, setStudents] = useState<MahasiswaRecord[]>([]);
  const [lecturers, setLecturers] = useState<DosenRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any[]>([]);

  // Statistics
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalLecturers: 0,
    totalCourses: 0,
    avgAttendance: 0
  });

  // Modal / Form states
  const [showAddForm, setShowAddForm] = useState(false);
  // Course form values
  const [newCourseId, setNewCourseId] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSks, setNewCourseSks] = useState('3');
  // Schedule form values
  const [newSchCourse, setNewSchCourse] = useState('');
  const [newSchDosen, setNewSchDosen] = useState('');
  const [newSchHari, setNewSchHari] = useState('Senin');
  const [newSchMulai, setNewSchMulai] = useState('07:00:00');
  const [newSchSelesai, setNewSchSelesai] = useState('09:30:00');
  const [newSchRuang, setNewSchRuang] = useState('A101');

  useEffect(() => {
    const initAdmin = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }

      await refreshData();
      setLoading(false);
    };

    initAdmin();
  }, [router]);

  const refreshData = async () => {
    // 1. Fetch Students (Join mahasiswa & users)
    const { data: mhsData } = await supabase
      .from('mahasiswa')
      .select(`
        id_user,
        nim,
        prodi,
        users (nama, email, role)
      `);

    const formattedStudents = (mhsData || []).map((m: any) => ({
      id_user: m.id_user,
      nim: m.nim,
      prodi: m.prodi,
      nama: m.users?.nama || 'Unknown',
      email: m.users?.email || '',
      role: 'mahasiswa'
    })) as MahasiswaRecord[];
    setStudents(formattedStudents);

    // 2. Fetch Lecturers (Join dosen & users)
    const { data: dsnData } = await supabase
      .from('dosen')
      .select(`
        id_user,
        nip,
        departemen,
        users (nama, email, role)
      `);

    const formattedLecturers = (dsnData || []).map((d: any) => ({
      id_user: d.id_user,
      nip: d.nip,
      departemen: d.departemen,
      nama: d.users?.nama || 'Unknown',
      email: d.users?.email || '',
      role: 'dosen'
    })) as DosenRecord[];
    setLecturers(formattedLecturers);

    // 3. Fetch Courses
    const { data: crsData } = await supabase.from('course').select('*');
    setCourses(crsData || []);

    // 4. Fetch Schedules
    const { data: schData } = await supabase
      .from('schedule')
      .select(`
        schedule_id,
        course_id,
        id_user_dosen,
        hari,
        waktu_mulai,
        waktu_selesai,
        ruangan,
        course (name),
        dosen (
          users (nama)
        )
      `);
    setSchedules(schData as unknown as ScheduleRecord[]);

    // 5. Fetch Attendance summary for exports
    const { data: attData } = await supabase
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
        ),
        session (
          schedule (
            ruangan,
            course (name)
          )
        )
      `);

    if (attData) {
      setAttendanceSummary(attData);
      
      const total = attData.length;
      const hadir = attData.filter((a: any) => a.status === 'Hadir').length;
      const avg = total > 0 ? Math.round((hadir / total) * 100) : 0;
      
      setStats({
        totalStudents: formattedStudents.length,
        totalLecturers: formattedLecturers.length,
        totalCourses: (crsData || []).length,
        avgAttendance: avg
      });
    }
  };

  // --- MOCK DATA SEED TRIGGER ---
  const handleSeedData = async () => {
    setSeeding(true);
    setAlertMsg(null);

    try {
      // 1. Seed courses
      const mockCourses = [
        { course_id: 'IF301', name: 'Rekayasa Perangkat Lunak', sks: 3 },
        { course_id: 'IF302', name: 'Pemrograman Berbasis Platform', sks: 4 },
        { course_id: 'IF303', name: 'Kecerdasan Buatan', sks: 3 },
        { course_id: 'IF304', name: 'Basis Data Terdistribusi', sks: 3 }
      ];

      for (const course of mockCourses) {
        await supabase.from('course').upsert(course);
      }

      // 2. Identify lecturer to bind schedules to
      let lecturerId = null;
      if (lecturers.length > 0) {
        lecturerId = lecturers[0].id_user;
      } else {
        // Look up any registered user with role = dosen
        const { data: lecturerUsers } = await supabase
          .from('users')
          .select('id_user')
          .eq('role', 'dosen')
          .limit(1);

        if (lecturerUsers && lecturerUsers.length > 0) {
          lecturerId = lecturerUsers[0].id_user;
        }
      }

      if (!lecturerId) {
        throw new Error('Harap daftarkan minimal 1 Dosen terlebih dahulu di form Sign Up agar jadwal kuliah dapat ditautkan.');
      }

      // 3. Seed schedules
      const mockSchedules = [
        { course_id: 'IF301', id_user_dosen: lecturerId, hari: 'Senin', waktu_mulai: '07:30:00', waktu_selesai: '10:00:00', ruangan: 'A102' },
        { course_id: 'IF302', id_user_dosen: lecturerId, hari: 'Selasa', waktu_mulai: '13:00:00', waktu_selesai: '16:20:00', ruangan: 'Lab Komputasi' },
        { course_id: 'IF303', id_user_dosen: lecturerId, hari: 'Rabu', waktu_mulai: '08:40:00', waktu_selesai: '11:10:00', ruangan: 'A201' }
      ];

      for (const sch of mockSchedules) {
        await supabase.from('schedule').insert(sch);
      }

      setAlertMsg({ type: 'success', text: 'Data simulasi mata kuliah & jadwal berhasil di-seed!' });
      await refreshData();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Gagal seeding data.' });
    } finally {
      setSeeding(false);
    }
  };

  // --- CRUD FUNCTIONS ---
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseId || !newCourseName) return;

    try {
      const { error } = await supabase
        .from('course')
        .insert({
          course_id: newCourseId,
          name: newCourseName,
          sks: parseInt(newCourseSks)
        });

      if (error) throw error;
      setAlertMsg({ type: 'success', text: 'Mata kuliah berhasil ditambahkan!' });
      setShowAddForm(false);
      setNewCourseId('');
      setNewCourseName('');
      await refreshData();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Gagal menambahkan mata kuliah.' });
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchCourse || !newSchDosen) {
      setAlertMsg({ type: 'error', text: 'Silakan pilih Mata Kuliah dan Dosen.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('schedule')
        .insert({
          course_id: newSchCourse,
          id_user_dosen: newSchDosen,
          hari: newSchHari,
          waktu_mulai: newSchMulai,
          waktu_selesai: newSchSelesai,
          ruangan: newSchRuang
        });

      if (error) throw error;
      setAlertMsg({ type: 'success', text: 'Jadwal kuliah berhasil dibuat!' });
      setShowAddForm(false);
      await refreshData();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Gagal membuat jadwal.' });
    }
  };

  const handleDeleteItem = async (table: string, keyField: string, keyValue: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return;

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(keyField, keyValue);

      if (error) throw error;
      setAlertMsg({ type: 'success', text: 'Data berhasil dihapus!' });
      await refreshData();
    } catch (err: any) {
      setAlertMsg({ type: 'error', text: err.message || 'Gagal menghapus data.' });
    }
  };

  // --- EXPORT MATRIX FUNCTIONS ---
  const handleExportExcel = () => {
    if (attendanceSummary.length === 0) {
      alert('Belum ada data kehadiran untuk diexport.');
      return;
    }

    // Format data matrix
    const matrix = attendanceSummary.map((row: any) => ({
      'Nama Mahasiswa': row.mahasiswa?.users?.nama || 'Unknown',
      'NIM': row.mahasiswa?.nim || '',
      'Program Studi': row.mahasiswa?.prodi || '',
      'Mata Kuliah': row.session?.schedule?.course?.name || 'Kuliah',
      'Kelas/Ruangan': row.session?.schedule?.ruangan || '',
      'Waktu Absen': new Date(row.timestamp).toLocaleString('id-ID'),
      'Status Kehadiran': row.status,
      'GPS Koordinat': row.koordinat_gps ? `${row.koordinat_gps.x}, ${row.koordinat_gps.y}` : 'Tidak Dideteksi'
    }));

    const worksheet = XLSX.utils.json_to_sheet(matrix);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Presensi");
    XLSX.writeFile(workbook, "rekap_presensi_sijalu_absen.xlsx");
  };

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 font-medium">Memuat Command Panel Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col print:bg-white print:text-black">
      
      {/* Hide navbar on PDF Print */}
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 space-y-6">
        
        {/* Header Admin */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-5 print:border-b-2 print:border-black">
          <div>
            <h1 className="text-2xl font-black tracking-wider uppercase text-white print:text-black">
              Admin Command Panel
            </h1>
            <p className="text-xs text-zinc-400 mt-1 print:text-zinc-650">
              Kelola entitas akademik, jadwal kelas, dan ekspor laporan kelembagaan.
            </p>
          </div>
          
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="px-3.5 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/20 text-indigo-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Seed Data Kuliah
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/20 text-emerald-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel Export
            </button>
            <button
              onClick={handlePrintPDF}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Cetak PDF
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {alertMsg && (
          <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs animate-fadeIn print:hidden ${
            alertMsg.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' 
              : 'bg-red-500/10 border-red-500/20 text-red-200'
          }`}>
            <AlertCircle className="h-4.5 w-4.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        {/* Unified Tab Navigation (Hidden on print) */}
        <div className="flex border-b border-zinc-900 overflow-x-auto print:hidden">
          <button
            onClick={() => { setActiveTab('analytics'); setShowAddForm(false); }}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'analytics' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistik Global
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('mahasiswa'); setShowAddForm(false); }}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'mahasiswa' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Mahasiswa ({students.length})
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('dosen'); setShowAddForm(false); }}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'dosen' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Dosen ({lecturers.length})
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('courses'); setShowAddForm(false); }}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'courses' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Mata Kuliah ({courses.length})
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('schedules'); setShowAddForm(false); }}
            className={`px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'schedules' ? 'border-violet-500 text-violet-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Jadwal Kelas ({schedules.length})
            </span>
          </button>
        </div>

        {/* Tab Context Content */}
        <div className="space-y-6">

          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              
              {/* Analytics Numeric Grid Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-2xl border border-zinc-900 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Mahasiswa</span>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-3xl font-black text-white">{stats.totalStudents}</span>
                    <GraduationCap className="h-8 w-8 text-violet-500/20" />
                  </div>
                </div>
                <div className="glass p-5 rounded-2xl border border-zinc-900 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Dosen</span>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-3xl font-black text-white">{stats.totalLecturers}</span>
                    <BookOpen className="h-8 w-8 text-emerald-500/20" />
                  </div>
                </div>
                <div className="glass p-5 rounded-2xl border border-zinc-900 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Mata Kuliah</span>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-3xl font-black text-white">{stats.totalCourses}</span>
                    <Calendar className="h-8 w-8 text-sky-500/20" />
                  </div>
                </div>
                <div className="glass p-5 rounded-2xl border border-zinc-900 flex flex-col justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Rasio Kehadiran</span>
                  <div className="flex items-end justify-between mt-4">
                    <span className="text-3xl font-black text-violet-400">{stats.avgAttendance}%</span>
                    <BarChart3 className="h-8 w-8 text-violet-500/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* PDF Attendance Summary Table for Audits */}
              <div className="glass rounded-2xl border border-zinc-800/80 overflow-hidden">
                <div className="p-4 bg-zinc-900/40 border-b border-zinc-900 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Log Rekap Absensi Global</h3>
                </div>

                {attendanceSummary.length === 0 ? (
                  <div className="p-12 text-center text-xs text-zinc-500">
                    Belum ada riwayat check-in tercatat di database.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Mahasiswa</th>
                          <th className="p-4">Program Studi</th>
                          <th className="p-4">Mata Kuliah</th>
                          <th className="p-4">Ruangan</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {attendanceSummary.map((row: any) => (
                          <tr key={row.attendance_id} className="hover:bg-zinc-900/30 text-zinc-350">
                            <td className="p-4 font-bold text-white">{row.mahasiswa?.users?.nama} ({row.mahasiswa?.nim})</td>
                            <td className="p-4">{row.mahasiswa?.prodi}</td>
                            <td className="p-4 font-medium text-white">{row.session?.schedule?.course?.name || 'Sesi Mandiri'}</td>
                            <td className="p-4">{row.session?.schedule?.ruangan}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                row.status === 'Hadir' 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : row.status === 'Izin' 
                                    ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' 
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-[10px]">{new Date(row.timestamp).toLocaleString('id-ID')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS GRID */}
          {activeTab === 'mahasiswa' && (
            <div className="glass rounded-2xl border border-zinc-900 overflow-hidden">
              <div className="p-4 bg-zinc-900/40 border-b border-zinc-900">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Daftar Mahasiswa</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">NIM</th>
                      <th className="p-4">Program Studi</th>
                      <th className="p-4">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {students.map(std => (
                      <tr key={std.id_user} className="hover:bg-zinc-900/20">
                        <td className="p-4 font-bold text-white">{std.nama}</td>
                        <td className="p-4 font-mono">{std.nim}</td>
                        <td className="p-4">{std.prodi}</td>
                        <td className="p-4 text-zinc-400">{std.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LECTURERS GRID */}
          {activeTab === 'dosen' && (
            <div className="glass rounded-2xl border border-zinc-900 overflow-hidden">
              <div className="p-4 bg-zinc-900/40 border-b border-zinc-900">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Daftar Dosen Pengampu</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">NIP</th>
                      <th className="p-4">Departemen</th>
                      <th className="p-4">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {lecturers.map(dsn => (
                      <tr key={dsn.id_user} className="hover:bg-zinc-900/20">
                        <td className="p-4 font-bold text-white">{dsn.nama}</td>
                        <td className="p-4 font-mono">{dsn.nip}</td>
                        <td className="p-4">{dsn.departemen}</td>
                        <td className="p-4 text-zinc-400">{dsn.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: COURSES CRUD */}
          {activeTab === 'courses' && (
            <div className="space-y-6">
              
              {/* Form Add Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-400 uppercase">Manajemen Mata Kuliah</span>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Matkul
                </button>
              </div>

              {showAddForm && (
                <div className="glass p-5 rounded-xl border border-zinc-900">
                  <form onSubmit={handleAddCourse} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Kode Matkul</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IF301"
                        value={newCourseId}
                        onChange={(e) => setNewCourseId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Nama Mata Kuliah</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Pemrograman Berorientasi Objek"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">SKS</label>
                      <select
                        value={newCourseSks}
                        onChange={(e) => setNewCourseSks(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="1">1 SKS</option>
                        <option value="2">2 SKS</option>
                        <option value="3">3 SKS</option>
                        <option value="4">4 SKS</option>
                      </select>
                    </div>
                    <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-850 rounded-lg text-xs font-semibold text-zinc-400"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-lg"
                      >
                        Simpan
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="glass rounded-2xl border border-zinc-900 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Kode Matkul</th>
                      <th className="p-4">Nama Mata Kuliah</th>
                      <th className="p-4">SKS</th>
                      <th className="p-4 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {courses.map(course => (
                      <tr key={course.course_id} className="hover:bg-zinc-900/20 text-zinc-300">
                        <td className="p-4 font-bold text-white font-mono">{course.course_id}</td>
                        <td className="p-4 font-medium text-white">{course.name}</td>
                        <td className="p-4 font-mono">{course.sks} SKS</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteItem('course', 'course_id', course.course_id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="h-4 w-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SCHEDULES CRUD */}
          {activeTab === 'schedules' && (
            <div className="space-y-6">
              
              {/* Form Add Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-400 uppercase">Jadwal Kuliah Departemen</span>
                <button
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    if (courses.length > 0) setNewSchCourse(courses[0].course_id);
                    if (lecturers.length > 0) setNewSchDosen(lecturers[0].id_user);
                  }}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Jadwal
                </button>
              </div>

              {showAddForm && (
                <div className="glass p-5 rounded-xl border border-zinc-900">
                  <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Mata Kuliah</label>
                      <select
                        value={newSchCourse}
                        onChange={(e) => setNewSchCourse(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none"
                      >
                        {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Dosen Pengampu</label>
                      <select
                        value={newSchDosen}
                        onChange={(e) => setNewSchDosen(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none"
                      >
                        {lecturers.map(l => <option key={l.id_user} value={l.id_user}>{l.nama}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Hari</label>
                      <select
                        value={newSchHari}
                        onChange={(e) => setNewSchHari(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none"
                      >
                        <option value="Senin">Senin</option>
                        <option value="Selasa">Selasa</option>
                        <option value="Rabu">Rabu</option>
                        <option value="Kamis">Kamis</option>
                        <option value="Jumat">Jumat</option>
                        <option value="Sabtu">Sabtu</option>
                        <option value="Minggu">Minggu</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Jam Mulai</label>
                      <input
                        type="text"
                        required
                        value={newSchMulai}
                        onChange={(e) => setNewSchMulai(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Jam Selesai</label>
                      <input
                        type="text"
                        required
                        value={newSchSelesai}
                        onChange={(e) => setNewSchSelesai(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Ruangan</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. A101"
                        value={newSchRuang}
                        onChange={(e) => setNewSchRuang(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-950 text-white focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3 flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-850 rounded-lg text-xs font-semibold text-zinc-400"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-4.5 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold rounded-lg"
                      >
                        Buat Jadwal
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="glass rounded-2xl border border-zinc-900 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-zinc-850 text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="p-4">Mata Kuliah</th>
                      <th className="p-4">Dosen Pengampu</th>
                      <th className="p-4">Hari & Jam</th>
                      <th className="p-4">Ruang</th>
                      <th className="p-4 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {schedules.map(sch => (
                      <tr key={sch.schedule_id} className="hover:bg-zinc-900/20 text-zinc-300">
                        <td className="p-4 font-bold text-white">{sch.course?.name}</td>
                        <td className="p-4 text-zinc-450">{sch.dosen?.users?.nama || 'Dosen Seeding'}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-850 text-[9px] font-bold text-violet-400 mr-2 uppercase tracking-wide">
                            {sch.hari}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">
                            {sch.waktu_mulai.substring(0, 5)} - {sch.waktu_selesai.substring(0, 5)}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-white">{sch.ruangan}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteItem('schedule', 'schedule_id', sch.schedule_id)}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="h-4 w-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </main>
    </div>
  );
}
