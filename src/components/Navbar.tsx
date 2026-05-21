'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogOut, User, Key, ShieldCheck, GraduationCap, BookOpen } from 'lucide-react';

interface UserProfile {
  nama: string;
  email: string;
  role: 'mahasiswa' | 'dosen' | 'admin';
}

export default function Navbar() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleDetails, setRoleDetails] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/');
        return;
      }

      // Fetch user profile from public.users
      const { data: userProfile } = await supabase
        .from('users')
        .select('nama, email, role')
        .eq('id_user', session.user.id)
        .single();

      if (userProfile) {
        setProfile(userProfile as UserProfile);

        // Fetch additional role specific detail
        if (userProfile.role === 'mahasiswa') {
          const { data } = await supabase
            .from('mahasiswa')
            .select('nim')
            .eq('id_user', session.user.id)
            .single();
          if (data) setRoleDetails(data.nim);
        } else if (userProfile.role === 'dosen') {
          const { data } = await supabase
            .from('dosen')
            .select('nip')
            .eq('id_user', session.user.id)
            .single();
          if (data) setRoleDetails(data.nip);
        } else if (userProfile.role === 'admin') {
          const { data } = await supabase
            .from('admin')
            .select('id_admin')
            .eq('id_user', session.user.id)
            .single();
          if (data) setRoleDetails(data.id_admin);
        }
      }
    };

    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!profile) return null;

  return (
    <nav className="glass border-b border-zinc-800/60 sticky top-0 z-50 px-4 py-3 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center glow-primary">
            <Key className="h-5 w-5 text-white" />
          </div>
          <span className="font-extrabold text-lg text-white tracking-wider">
            SIJALU <span className="text-gradient">ABSEN</span>
          </span>
        </div>

        {/* User Stats / Controls */}
        <div className="flex items-center gap-4">
          
          {/* User Meta Card (Hidden on narrow mobile screens) */}
          <div className="hidden sm:flex items-center gap-3 border-r border-zinc-800/80 pr-4">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
              {profile.role === 'mahasiswa' && <GraduationCap className="h-4 w-4 text-violet-400" />}
              {profile.role === 'dosen' && <BookOpen className="h-4 w-4 text-emerald-400" />}
              {profile.role === 'admin' && <ShieldCheck className="h-4 w-4 text-rose-400" />}
            </div>
            <div className="text-left leading-none">
              <p className="text-xs font-bold text-white">{profile.nama}</p>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-mono">
                {profile.role} • {roleDetails}
              </p>
            </div>
          </div>

          {/* User Badge (Visible on mobile) */}
          <div className="sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-300">
            {profile.role === 'mahasiswa' && <GraduationCap className="h-3 w-3 text-violet-400" />}
            {profile.role === 'dosen' && <BookOpen className="h-3 w-3 text-emerald-400" />}
            {profile.role === 'admin' && <ShieldCheck className="h-3 w-3 text-rose-400" />}
            <span className="uppercase">{profile.nama.split(' ')[0]}</span>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

        </div>
      </div>
    </nav>
  );
}
