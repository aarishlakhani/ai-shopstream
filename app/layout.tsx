import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Shopstream - Live Interactive Shopping',
  description: 'Live interactive shopping powered by AI avatars. Experience the future of e-commerce with personalized product demonstrations and real-time assistance.',
  keywords: 'AI shopping, live commerce, interactive shopping, AI avatar, e-commerce, Shopify',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
