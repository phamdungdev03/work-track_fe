'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
const AttendanceApp = dynamic(() => import('@/features/attendance/components/attendance-app'), { ssr: false, loading: () => <div className="boot-screen"><div className="boot-brand"><Image src="/logo_1682346838.png.webp" alt="" width={52} height={47} /><strong>Hương Việt Sinh</strong></div><p>Đang mở không gian chấm công…</p></div> });
export default function ClientEntry() { return <AttendanceApp />; }
