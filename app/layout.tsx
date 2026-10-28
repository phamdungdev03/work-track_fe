import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import "@fontsource-variable/noto-sans";

export const metadata: Metadata = { title: 'Chấm công · Hương Việt Sinh', description: 'Hệ thống chấm công nhiều cơ sở của Hương Việt Sinh.', icons: { icon: '/logo_1682346838.png.webp' } };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="vi"><body>{children}</body></html>; }
