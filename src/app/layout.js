import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata = {
  title: 'Dairy ERP',
  description: 'Internal ERP for Dairy Products Company',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1a1a2e',
              color: '#f0f0f0',
              border: '1px solid #2a2a4a',
              borderRadius: '10px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#4ade80', secondary: '#1a1a2e' },
            },
            error: {
              iconTheme: { primary: '#f87171', secondary: '#1a1a2e' },
            },
          }}
        />
      </body>
    </html>
  )
}