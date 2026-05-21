'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { 
  Camera, 
  Key, 
  MapPin, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';

export default function ScanPage() {
  const router = useRouter();
  
  // Tab control: 'qr' or 'pin'
  const [method, setMethod] = useState<'qr' | 'pin'>('qr');
  
  // Scanner states
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const qrRegionId = 'qr-reader-target';
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Form PIN states
  const [pin, setPin] = useState('');
  
  // Global actions states
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Geolocation
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // 1. Get Geolocation on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationLoading(false);
        },
        (error) => {
          console.warn('Geolocation denied or unavailable:', error);
          setLocationError('Akses lokasi ditolak. Presensi akan tetap dilanjutkan tanpa verifikasi GPS.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 2. Manage QR Scanner Lifecycle
  useEffect(() => {
    if (method === 'qr' && !successMsg) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [method, successMsg]);

  const startScanner = async () => {
    setScannerError(null);
    setScanning(true);
    
    // Give DOM a split second to render the target div
    setTimeout(async () => {
      try {
        const qrScanner = new Html5Qrcode(qrRegionId);
        html5QrcodeRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            // Success callback
            setScanResult(decodedText);
            handleAttendanceSubmission({ qrToken: decodedText });
            stopScanner();
          },
          (errorMessage) => {
            // Verbose error logging, keep it silent from UI unless critical
          }
        );
      } catch (err: any) {
        console.error('QR start error:', err);
        setScannerError('Gagal membuka kamera. Pastikan izin kamera telah diberikan.');
        setScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setScanning(false);
  };

  const triggerConfetti = () => {
    // Elegant fireworks confetti trigger
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, animate a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // 3. Process Attendance Check-In
  const handleAttendanceSubmission = async (params: { qrToken?: string; pinCode?: string }) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) {
        throw new Error('Sesi masuk telah berakhir. Silakan login kembali.');
      }

      let activeSession = null;

      // Case A: QR Token Verification
      if (params.qrToken) {
        let parsed = { session_id: '', token: '' };
        try {
          parsed = JSON.parse(params.qrToken);
        } catch {
          // If not JSON, treat raw text as qr_code_token
          parsed = { session_id: '', token: params.qrToken };
        }

        const query = supabase
          .from('session')
          .select('session_id, expiry_time')
          .eq('qr_code_token', parsed.token || parsed.session_id); // Match either token or text

        const { data, error: sessionErr } = await query.maybeSingle();
        if (sessionErr) throw sessionErr;
        activeSession = data;
      } 
      // Case B: PIN Fallback Verification
      else if (params.pinCode) {
        const { data, error: sessionErr } = await supabase
          .from('session')
          .select('session_id, expiry_time')
          .eq('unique_code', params.pinCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionErr) throw sessionErr;
        activeSession = data;
      }

      if (!activeSession) {
        throw new Error('Sesi presensi tidak ditemukan atau kode salah.');
      }

      // Check Expiry
      const now = new Date();
      const expiry = new Date(activeSession.expiry_time);
      if (now > expiry) {
        throw new Error('Sesi presensi telah berakhir / kedaluwarsa.');
      }

      // Set up GPS Coordinate Format for PostgreSQL POINT (x,y) -> (lng, lat)
      const gpsPoint = coords ? `(${coords.lng}, ${coords.lat})` : null;

      // Insert Attendance Record
      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({
          session_id: activeSession.session_id,
          id_user_mahasiswa: authSession.user.id,
          status: 'Hadir',
          koordinat_gps: gpsPoint
        });

      if (insertErr) {
        // Handle unique constraint duplicate check-ins
        if (insertErr.code === '23505') {
          throw new Error('Anda sudah melakukan presensi di kelas ini.');
        }
        throw insertErr;
      }

      // Trigger gamified success confetti
      setSuccessMsg('Presensi Berhasil Terdaftar! Selamat Kuliah.');
      triggerConfetti();

      // Redirect back to dashboard
      setTimeout(() => {
        router.push('/dashboard/mahasiswa');
      }, 3000);

    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirimkan presensi.');
      // Restart scanner if failed QR
      if (params.qrToken) {
        setScanResult(null);
        startScanner();
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setErrorMsg('Masukkan kode PIN yang valid.');
      return;
    }
    handleAttendanceSubmission({ pinCode: pin.trim() });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 flex flex-col justify-between pb-12">
        
        {/* Back and Title Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/mahasiswa" 
              onClick={stopScanner}
              className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="text-base font-bold text-white">Lakukan Presensi</h2>
          </div>

          {/* Toggle scan method */}
          <div className="grid grid-cols-2 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800/60">
            <button
              onClick={() => { setMethod('qr'); setErrorMsg(null); }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                method === 'qr' 
                  ? 'bg-violet-600 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Scan QR Code
            </button>
            <button
              onClick={() => { setMethod('pin'); setErrorMsg(null); }}
              className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                method === 'pin' 
                  ? 'bg-violet-600 text-white shadow-md' 
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Key className="h-3.5 w-3.5" />
              Gunakan PIN
            </button>
          </div>
        </div>

        {/* Dynamic Panel (Center Area) */}
        <div className="my-8 flex-1 flex flex-col justify-center">

          {successMsg ? (
            /* SUCCESS SCREEN */
            <div className="glass p-6 rounded-2xl text-center space-y-4 border-emerald-500/20 glow-success animate-fadeIn">
              <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Sukses!</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{successMsg}</p>
                <p className="text-[10px] text-violet-400 mt-4 animate-pulse">Mengalihkan ke dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* METHOD QR SCANNER */}
              {method === 'qr' && (
                <div className="space-y-4">
                  <div className="relative aspect-square w-full max-w-[280px] mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-inner flex items-center justify-center">
                    
                    {/* Scanner Canvas Target */}
                    <div id={qrRegionId} className="w-full h-full [&_video]:object-cover" />
                    
                    {/* Scanner Frame Overlay */}
                    {scanning && (
                      <>
                        <div className="absolute inset-8 border border-white/20 rounded-xl pointer-events-none" />
                        <div className="scanline" />
                      </>
                    )}

                    {!scanning && !scannerError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                        <span className="text-xs">Menyiapkan kamera...</span>
                      </div>
                    )}

                    {scannerError && (
                      <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 text-center gap-3">
                        <Camera className="h-8 w-8 text-zinc-600" />
                        <p className="text-[11px] leading-relaxed">{scannerError}</p>
                        <button
                          onClick={startScanner}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-violet-400 hover:text-white flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Coba Lagi
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-zinc-400">
                    Arahkan kamera ke kode QR yang ditayangkan dosen di depan kelas.
                  </p>
                </div>
              )}

              {/* METHOD PIN FALLBACK FORM */}
              {method === 'pin' && (
                <div className="glass p-5 rounded-2xl border border-zinc-900">
                  <form onSubmit={handlePinSubmit} className="space-y-5">
                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-bold text-white">Masukkan PIN Presensi</h3>
                      <p className="text-xs text-zinc-400 leading-normal">
                        Ketik 6-digit kode unik yang diberikan dosen sebagai alternatif scan QR.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        maxLength={10}
                        placeholder="e.g. 839210"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full text-center py-3.5 text-xl font-mono tracking-widest rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-700 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all uppercase"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 glow-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Verifikasi Kehadiran'
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Location / Geolocation Status Bar */}
        <div className="glass px-3.5 py-3 rounded-xl border border-zinc-900/60 flex items-center gap-3">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
            coords ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-900 text-zinc-500'
          }`}>
            {locationLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="text-left leading-none">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Verifikasi Lokasi (GPS)</span>
            <span className="text-[11px] font-bold text-white mt-1 block">
              {locationLoading 
                ? 'Mendeteksi titik koordinat Anda...' 
                : coords 
                  ? `Terdeteksi (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})` 
                  : locationError 
                    ? 'Akses GPS dinonaktifkan' 
                    : 'GPS belum terdeteksi'}
            </span>
          </div>
        </div>

      </main>
    </div>
  );
}
