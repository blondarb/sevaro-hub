import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { NavBar } from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Sevaro Hub',
  description: 'Projects & tools built by Steve Arbogast',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
