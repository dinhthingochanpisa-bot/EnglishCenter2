import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LumaOS | Trung tâm điều hành',description:'LMS + CRM SaaS – Quản trị tổ chức, nhân sự và phân quyền'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
