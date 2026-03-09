"use client"

import { useState, useEffect, useCallback } from "react"
import { List, X, Wrench, SquaresFour, Users, ChatCircle, Gear, Lightning, Package, SignOut, UserCircle, CaretUp, CalendarBlank, Clock, ChartBar } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [shopLogo, setShopLogo] = useState<string | null>(null)
  const [shopName, setShopName] = useState<string>("RO Engine")
  const { user, roles, logout, hasRole } = useAuth()
  const isHoursAdmin = hasRole("Owner") || hasRole("Manager")

  // Setup incomplete badge
  const [setupIncomplete, setSetupIncomplete] = useState(false)

  // Timeclock state
  const [clockStatus, setClockStatus] = useState<'clocked_in' | 'clocked_out' | null>(null)
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [shopTimezone, setShopTimezone] = useState('America/Chicago')
  const [clockLoading, setClockLoading] = useState(false)

  const userInitials = user?.name
    ? user.name.split(" ").map(part => part[0]).join("").toUpperCase().slice(0, 2)
    : "?"
  const primaryRole = roles.length > 0 ? roles[0].name : "User"

  // Short name: "Joe S." from "Joe Sprandel"
  const shortName = user?.name
    ? (() => {
        const parts = user.name.trim().split(/\s+/)
        if (parts.length === 1) return parts[0]
        return `${parts[0]} ${parts[parts.length - 1][0]}.`
      })()
    : ""

  useEffect(() => {
    // Fetch shop profile to get logo
    const fetchShopProfile = () => {
      fetch('/api/settings/shop-profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.profile) {
            if (data.profile.logo_url) {
              // Add cache-busting timestamp to force reload
              setShopLogo(`${data.profile.logo_url}?t=${Date.now()}`)
            } else {
              setShopLogo(null)
            }
            if (data.profile.shop_name) {
              setShopName(data.profile.shop_name)
            }
          }
        })
        .catch(() => { /* uses default values on failure */ })
    }

    fetchShopProfile()

    // Check setup status for incomplete badge
    fetch('/api/setup')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.setup_complete && data.setup_steps_skipped?.length > 0) {
          setSetupIncomplete(true)
        }
      })
      .catch(() => {})

    // Listen for logo update events
    const handleLogoUpdate = () => {
      fetchShopProfile()
    }
    window.addEventListener('shop-logo-updated', handleLogoUpdate)
    
    return () => {
      window.removeEventListener('shop-logo-updated', handleLogoUpdate)
    }
  }, [])

  // Timeclock: fetch status on mount
  const fetchClockStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const res = await fetch('/api/timeclock/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setClockStatus(data.status)
        setLastEvent(data.lastEvent)
        if (data.timezone) setShopTimezone(data.timezone)
      }
    } catch {
      // Non-critical — silently fail
    }
  }, [])

  useEffect(() => {
    if (user) fetchClockStatus()
    const handleClockEvent = () => fetchClockStatus()
    window.addEventListener('clock-status-changed', handleClockEvent)
    return () => window.removeEventListener('clock-status-changed', handleClockEvent)
  }, [user, fetchClockStatus])

  const handleClockToggle = async () => {
    setClockLoading(true)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return
      const endpoint = clockStatus === 'clocked_in'
        ? '/api/timeclock/clock-out'
        : '/api/timeclock/clock-in'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        await fetchClockStatus()
        toast.success(clockStatus === 'clocked_in' ? 'Clocked out' : 'Clocked in')
        window.dispatchEvent(new Event('clock-status-changed'))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to update clock status')
      }
    } catch {
      toast.error('Failed to update clock status')
    } finally {
      setClockLoading(false)
    }
  }

  function formatClockTime(isoTimestamp: string): string {
    const date = new Date(isoTimestamp)
    return date.toLocaleString('en-US', {
      timeZone: shopTimezone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase()
  }

  const navItems = [
    { icon: SquaresFour, label: "Dashboard", href: "/" },
    { icon: CalendarBlank, label: "Schedule", href: "/schedule" },
    { icon: Wrench, label: "Repair Orders", href: "/repair-orders" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: Package, label: "Parts Manager", href: "/parts-manager" },
    { icon: ChatCircle, label: "Communications", href: "/communications" },
    { icon: ChartBar, label: "Reports", href: "/reports" },

    { icon: Lightning, label: "AI Assistant", href: "/ai-assistant", beta: true },
    { icon: Gear, label: "Settings", href: "/settings", setupBadge: true },
  ]

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-40 lg:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground border border-sidebar-border hover:bg-sidebar-accent"
      >
        {isOpen ? <X size={20} /> : <List size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky inset-y-0 left-0 lg:top-0 lg:h-screen z-30 w-64 bg-slate-100 dark:bg-slate-900 border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 flex flex-col overflow-y-auto shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-sidebar-border">
          {shopLogo ? (
            <Image
              src={shopLogo}
              alt={shopName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-contain"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary to-blue-600 flex items-center justify-center">
              <Wrench size={24} className="text-sidebar-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">{shopName}</h1>
            <p className="text-xs text-sidebar-accent-foreground">AI Powered</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary">β</span>
              )}
              {item.setupBadge && setupIncomplete && (
                <span className="w-2 h-2 rounded-full bg-orange-400" title="Setup incomplete" />
              )}
            </a>
          ))}
        </nav>

        {/* User profile + Timeclock */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent w-full text-left transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-blue-600 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {shortName ? `${shortName} in ${shopName}` : user?.name ?? "Loading..."}
                  </p>
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    clockStatus === 'clocked_in'
                      ? 'text-green-500'
                      : clockStatus === 'clocked_out'
                      ? 'text-orange-400'
                      : 'text-sidebar-accent-foreground'
                  )}>
                    {clockStatus === 'clocked_in' ? 'CLOCKED IN: ' : clockStatus === 'clocked_out' ? 'CLOCKED OUT: ' : primaryRole}
                    {clockStatus && lastEvent && (
                      <span className="font-normal">{formatClockTime(lastEvent)}</span>
                    )}
                  </p>
                </div>
                <CaretUp size={16} className="text-sidebar-accent-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info("Profile settings coming soon")}>
                <UserCircle size={16} />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/hours">
                  <Clock size={16} />
                  My Hours
                </a>
              </DropdownMenuItem>
              {isHoursAdmin && (
                <DropdownMenuItem asChild>
                  <a href="/hours?view=admin">
                    <Clock size={16} />
                    Hours Manager
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <SignOut size={16} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timeclock toggle button */}
          {clockStatus !== null && (
            <button
              onClick={handleClockToggle}
              disabled={clockLoading}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                clockStatus === 'clocked_in'
                  ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                  : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
              )}
            >
              <Clock size={16} weight="bold" />
              {clockLoading
                ? 'Updating...'
                : clockStatus === 'clocked_in' ? 'Clock Out' : 'Clock In'}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
