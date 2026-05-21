export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id_user: string
          nama: string
          email: string
          role: 'mahasiswa' | 'dosen' | 'admin'
          created_at: string
        }
        Insert: {
          id_user: string
          nama: string
          email: string
          role: 'mahasiswa' | 'dosen' | 'admin'
          created_at?: string
        }
        Update: {
          id_user?: string
          nama?: string
          email?: string
          role?: 'mahasiswa' | 'dosen' | 'admin'
          created_at?: string
        }
      }
      mahasiswa: {
        Row: {
          id_user: string
          nim: string
          prodi: string
        }
        Insert: {
          id_user: string
          nim: string
          prodi: string
        }
        Update: {
          id_user?: string
          nim?: string
          prodi?: string
        }
      }
      dosen: {
        Row: {
          id_user: string
          nip: string
          departemen: string
        }
        Insert: {
          id_user: string
          nip: string
          departemen: string
        }
        Update: {
          id_user?: string
          nip?: string
          departemen?: string
        }
      }
      admin: {
        Row: {
          id_user: string
          id_admin: string
        }
        Insert: {
          id_user: string
          id_admin: string
        }
        Update: {
          id_user?: string
          id_admin?: string
        }
      }
      course: {
        Row: {
          course_id: string
          name: string
          sks: number
        }
        Insert: {
          course_id: string
          name: string
          sks: number
        }
        Update: {
          course_id?: string
          name?: string
          sks?: number
        }
      }
      schedule: {
        Row: {
          schedule_id: string
          course_id: string
          id_user_dosen: string
          hari: string
          waktu_mulai: string
          waktu_selesai: string
          ruangan: string
        }
        Insert: {
          schedule_id?: string
          course_id: string
          id_user_dosen: string
          hari: string
          waktu_mulai: string
          waktu_selesai: string
          ruangan: string
        }
        Update: {
          schedule_id?: string
          course_id?: string
          id_user_dosen?: string
          hari?: string
          waktu_mulai?: string
          waktu_selesai?: string
          ruangan?: string
        }
      }
      session: {
        Row: {
          session_id: string
          schedule_id: string
          id_user_dosen: string
          qr_code_token: string
          unique_code: string
          expiry_time: string
          created_at: string
        }
        Insert: {
          session_id?: string
          schedule_id: string
          id_user_dosen: string
          qr_code_token: string
          unique_code: string
          expiry_time: string
          created_at?: string
        }
        Update: {
          session_id?: string
          schedule_id?: string
          id_user_dosen?: string
          qr_code_token?: string
          unique_code?: string
          expiry_time?: string
          created_at?: string
        }
      }
      attendance: {
        Row: {
          attendance_id: number
          session_id: string
          id_user_mahasiswa: string
          timestamp: string
          status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
          koordinat_gps: string | null
        }
        Insert: {
          attendance_id?: number
          session_id: string
          id_user_mahasiswa: string
          timestamp?: string
          status?: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
          koordinat_gps?: string | null
        }
        Update: {
          attendance_id?: number
          session_id?: string
          id_user_mahasiswa?: string
          timestamp?: string
          status?: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
          koordinat_gps?: string | null
        }
      }
    }
    Enums: {
      user_role: 'mahasiswa' | 'dosen' | 'admin'
      attendance_status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpa'
    }
  }
}
