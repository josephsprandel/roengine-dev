"use client"

import { useState, useEffect } from "react"
import { List, X, Wrench, SquaresFour, Users, ChatCircle, Gear, Lightning, ChartBar, Package, Trash, SignOut, UserCircle, CaretUp } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
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
  const { user, roles, logout } = useAuth()

  const userInitials = user?.name
    ? user.name.split(" ").map(part => part[0]).join("").toUpperCase().slice(0, 2)
    : "?"
  const primaryRole = roles.length > 0 ? roles[0].name : "User"

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
        .catch(() => {})
    }

    fetchShopProfile()

    // Listen for logo update events
    const handleLogoUpdate = () => {
      fetchShopProfile()
    }
    window.addEventListener('shop-logo-updated', handleLogoUpdate)
    
    return () => {
      window.removeEventListener('shop-logo-updated', handleLogoUpdate)
    }
  }, [])

  const navItems = [
    { icon: SquaresFour, label: "Dashboard", href: "/" },
    { icon: Wrench, label: "Repair Orders", href: "/repair-orders" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: Package, label: "Parts Manager", href: "/parts-manager" },
    { icon: ChatCircle, label: "Communications", href: "#" },
    { icon: ChartBar, label: "Analytics", href: "#" },
    { icon: Lightning, label: "AI Assistant", href: "/ai-assistant", beta: true },
    { icon: Trash, label: "Recycle Bin", href: "/recycle-bin" },
    { icon: Gear, label: "Settings", href: "/settings" },
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
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-100 dark:bg-slate-900 border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 flex flex-col",
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
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary">β</span>
              )}
            </a>
          ))}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent w-full text-left transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-blue-600 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? "Loading..."}</p>
                  <p className="text-xs text-sidebar-accent-foreground truncate">{primaryRole}</p>
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
              <DropdownMenuItem onClick={() => alert("Coming soon")}>
                <UserCircle size={16} />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <SignOut size={16} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
