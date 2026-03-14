import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sevaro Hub',
  description: 'Projects & tools built by Steve Arbogast',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
