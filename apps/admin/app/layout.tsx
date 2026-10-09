import type { Metadata, Viewport } from 'next';
import { PwaRegister } from './pwa-register';
// @ts-ignore
import './globals.css';

import { getAdminSession } from '../lib/auth';
import { AdminSidebar } from '../components/admin-sidebar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Data Extractor Admin',
  description: 'Administration portal for the handwritten data extraction platform.',
  applicationName: 'Data Extractor Admin',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Data Extractor Admin',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {session ? (
          <div className="admin-shell">
            <AdminSidebar
              user={{
                id: session.userId,
                name: session.name,
                email: session.email,
                role: session.role,
              }}
            />

            <div className="admin-main">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
