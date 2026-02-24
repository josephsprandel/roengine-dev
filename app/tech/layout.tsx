'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, LogOut, Wrench } from 'lucide-react'

export default function TechLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dark top bar */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900 text-white flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Wrench size={20} className="text-primary" />
          <span className="font-semibold text-base">RO Engine Tech</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">{user?.name}</span>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Content area */}
      <main className="pb-safe">
        {children}
      </main>
    </div>
  )
}
