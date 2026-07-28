import './globals.css';

export const metadata = {
  title: 'Eldercare Coordination App',
  description: 'Family elder-care coordination for Taiwan families',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
