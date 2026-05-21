'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  GraduationCap, 
  BookOpen, 
  Shield, 
  Mail, 
  Lock, 
  User, 
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Key
} from 'lucide-react';

type Role = 'mahasiswa' | 'dosen' | 'admin';

export default function AuthPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('mahasiswa');
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [identifier, setIdentifier] = useState(''); // Can be NIM/NIP/Admin ID or email for login
  
  // Role specific sign up states
  const [nim, setNim] = useState('');
  const [prodi, setProdi] = useState('');
  const [nip, setNip] = useState('');
  const [departemen, setDepartemen] = useState('');
  const [idAdmin, setIdAdmin] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if already logged in and redirect
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id_user', session.user.id)
          .single();
        
        if (profile?.role) {
          router.push(`/dashboard/${profile.role}`);
        }
      }
    };
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let loginEmail = identifier.trim();

      // If it doesn't look like an email, lookup in role-specific profile tables
      if (!loginEmail.includes('@')) {
        let userId = null;

        if (role === 'mahasiswa') {
          const { data, error: fetchErr } = await supabase
            .from('mahasiswa')
            .select('id_user')
            .eq('nim', loginEmail)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (data) userId = data.id_user;
        } else if (role === 'dosen') {
          const { data, error: fetchErr } = await supabase
            .from('dosen')
            .select('id_user')
            .eq('nip', loginEmail)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (data) userId = data.id_user;
        } else if (role === 'admin') {
          const { data, error: fetchErr } = await supabase
            .from('admin')
            .select('id_user')
            .eq('id_admin', loginEmail)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (data) userId = data.id_user;
        }

        if (!userId) {
          throw new Error(`Kredensial ${role === 'mahasiswa' ? 'NIM' : role === 'dosen' ? 'NIP' : 'ID Admin'} tidak ditemukan.`);
        }

        // Fetch actual email from public.users
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('email')
          .eq('id_user', userId)
          .single();
        if (userErr) throw userErr;
        if (userData) {
          loginEmail = userData.email;
        }
      }

      // Perform auth sign in
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: password,
      });

      if (authErr) throw authErr;

      if (data.user) {
        // Fetch role to ensure alignment
        const { data: profile, error: profileErr } = await supabase
          .from('users')
          .select('role')
          .eq('id_user', data.user.id)
          .single();

        if (profileErr) throw profileErr;
        
        setSuccess('Login berhasil! Mengalihkan...');
        setTimeout(() => {
          router.push(`/dashboard/${profile.role}`);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal login. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Dynamic checks
    if (role === 'mahasiswa' && (!nim || !prodi)) {
      setError('NIM dan Program Studi harus diisi.');
      setLoading(false);
      return;
    }
    if (role === 'dosen' && (!nip || !departemen)) {
      setError('NIP dan Departemen harus diisi.');
      setLoading(false);
      return;
    }
    if (role === 'admin') {
      setError('Registrasi administrator tidak diizinkan.');
      setLoading(false);
      return;
    }

    try {
      // Package metadata for trigger function
      const metadata: Record<string, any> = {
        role,
        nama,
      };

      if (role === 'mahasiswa') {
        metadata.nim = nim;
        metadata.prodi = prodi;
      } else if (role === 'dosen') {
        metadata.nip = nip;
        metadata.departemen = departemen;
      } else if (role === 'admin') {
        metadata.id_admin = idAdmin;
      }

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: metadata,
        },
      });

      if (signUpErr) throw signUpErr;

      setSuccess('Registrasi berhasil! Silakan login.');
      setActiveTab('login');
      // Autofill fields
      if (role === 'mahasiswa') setIdentifier(nim);
      else if (role === 'dosen') setIdentifier(nip);
      else if (role === 'admin') setIdentifier(idAdmin);
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Pendaftaran gagal. Periksa kembali formulir Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-premium relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        
        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center glow-primary mb-4">
            <Key className="h-8 w-8 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            SIJALU <span className="text-gradient font-bold">ABSEN</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Sistem Informasi Presensi Mahasiswa Real-Time
          </p>
        </div>

        {/* Auth Glass Card */}
        <div className="glass-premium rounded-2xl p-6 md:p-8">
          
          {/* Tabs header */}
          <div className="flex border-b border-zinc-800/80 pb-4 mb-6">
            <button
              onClick={() => { setActiveTab('login'); setError(null); }}
              className={`flex-1 text-center py-2 text-sm font-semibold transition-colors relative ${
                activeTab === 'login' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Log In
              {activeTab === 'login' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => { 
                setActiveTab('register'); 
                setError(null); 
                if (role === 'admin') {
                  setRole('mahasiswa');
                }
              }}
              className={`flex-1 text-center py-2 text-sm font-semibold transition-colors relative ${
                activeTab === 'register' ? 'text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Sign Up
              {activeTab === 'register' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Role selector cards */}
          <div className="mb-6">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-3">
              Pilih Peran Anda
            </label>
            <div className={`grid gap-2 ${activeTab === 'register' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <button
                type="button"
                onClick={() => setRole('mahasiswa')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  role === 'mahasiswa'
                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                    : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <GraduationCap className="h-5 w-5 mb-1.5" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Mahasiswa</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('dosen')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  role === 'dosen'
                    ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                    : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <BookOpen className="h-5 w-5 mb-1.5" />
                <span className="text-[10px] font-bold tracking-wider uppercase">Dosen</span>
              </button>
              {activeTab === 'login' && (
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    role === 'admin'
                      ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                      : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Shield className="h-5 w-5 mb-1.5" />
                  <span className="text-[10px] font-bold tracking-wider uppercase">Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback banners */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">
                  {role === 'mahasiswa' ? 'NIM / Email' : role === 'dosen' ? 'NIP / Email' : 'ID Admin / Email'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder={
                      role === 'mahasiswa' 
                        ? 'NIM (e.g. 24060120140001)' 
                        : role === 'dosen' 
                          ? 'NIP (e.g. 1985031201)' 
                          : 'ID Admin (e.g. ADM01)'
                    }
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="email"
                    required
                    placeholder="name@university.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              </div>

              {/* Mahasiswa-only form fields */}
              {role === 'mahasiswa' && (
                <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">NIM</label>
                    <input
                      type="text"
                      required
                      placeholder="24060120140001"
                      value={nim}
                      onChange={(e) => setNim(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Prodi</label>
                    <input
                      type="text"
                      required
                      placeholder="Teknik Informatika"
                      value={prodi}
                      onChange={(e) => setProdi(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Dosen-only form fields */}
              {role === 'dosen' && (
                <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">NIP</label>
                    <input
                      type="text"
                      required
                      placeholder="1985031201"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Departemen</label>
                    <input
                      type="text"
                      required
                      placeholder="Ilmu Komputer"
                      value={departemen}
                      onChange={(e) => setDepartemen(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Admin-only form fields */}
              {role === 'admin' && (
                <div className="animate-fadeIn">
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">ID Admin</label>
                  <input
                    type="text"
                    required
                    placeholder="ADM01"
                    value={idAdmin}
                    onChange={(e) => setIdAdmin(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign Up
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer Notes */}
        <p className="text-center text-xs text-zinc-500 mt-8">
          SIJALU ABSEN &copy; 2026. Made with &hearts; for Department of Computer Science.
        </p>

      </div>
    </div>
  );
}
