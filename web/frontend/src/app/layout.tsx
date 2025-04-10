import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import EnvironmentValidator from '@/components/EnvironmentValidator';
import { AudioProvider } from '@/contexts/AudioContext';
import { VoiceProvider } from '@/contexts/VoiceContext';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import MediaDownloadProvider from '@/contexts/MediaDownloadProvider';
import { ProjectProvider } from '@/components/project/ProjectProvider';
// import dynamic from 'next/dynamic';

// No need for dynamic import with our simplified ErrorBoundary
// const DynamicErrorBoundary = dynamic(
//   () => import('@/components/ui/ErrorBoundary'),
//   { ssr: false }
// );

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Auto Shorts - Convert Content to Engaging Short Videos',
  description: 'Create engaging short-form videos automatically from online content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <ErrorBoundary>
          <AudioProvider>
            <VoiceProvider>
              <MediaDownloadProvider>
                <ProjectProvider>
                  <Header />
                  <main className="flex-grow py-8 bg-gray-50">{children}</main>
                  <Footer />
                  <EnvironmentValidator />
                </ProjectProvider>
              </MediaDownloadProvider>
            </VoiceProvider>
          </AudioProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
