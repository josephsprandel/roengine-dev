"use client"

import { useState, useEffect } from "react"
import { Menu, X, Wrench, LayoutDashboard, Users, MessageSquare, Settings, Zap, BarChart3, Package, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [shopLogo, setShopLogo] = useState<string | null>(null)
  const [shopName, setShopName] = useState<string>("RO Engine")

  useEffect(() => {
    // Fetch shop profile to get logo
    fetch('/api/settings/shop-profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.profile) {
          if (data.profile.logo_url) {
            setShopLogo(data.profile.logo_url)
          }
          if (data.profile.shop_name) {
            setShopName(data.profile.shop_name)
          }
        }
      })
      .catch(() => {})
  }, [])

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Wrench, label: "Repair Orders", href: "/repair-orders" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: Package, label: "Parts Manager", href: "/parts-manager" },
    { icon: MessageSquare, label: "Communications", href: "#" },
    { icon: BarChart3, label: "Analytics", href: "#" },
    { icon: Zap, label: "AI Assistant", href: "/ai-assistant", beta: true },
    { icon: Trash2, label: "Recycle Bin", href: "/recycle-bin" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ]

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-40 lg:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground border border-sidebar-border hover:bg-sidebar-accent"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 flex flex-col",
          "before:absolute before:inset-0 before:bg-gradient-to-b before:from-sidebar-primary/5 before:to-transparent before:pointer-events-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo section with premium styling */}
        <div className="relative z-10 flex items-center gap-3 px-6 py-8 border-b border-sidebar-border/50 bg-gradient-to-r from-sidebar-primary/10 via-transparent to-transparent">
          {shopLogo ? (
            <Image
              src={shopLogo}
              alt={shopName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-contain ring-2 ring-sidebar-primary/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary to-orange-700 flex items-center justify-center ring-2 ring-sidebar-primary/40 shadow-lg">
              <Wrench size={24} className="text-sidebar-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground tracking-tight">{shopName}</h1>
            <p className="text-xs text-sidebar-accent-foreground font-medium">AUTOMOTIVE AI</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 relative z-10">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-md transition-all duration-200 text-sm font-medium",
                "text-sidebar-foreground hover:bg-sidebar-primary/15 hover:text-sidebar-primary",
                "relative group"
              )}
            >
              <div className="absolute inset-y-0 left-0 w-1 bg-sidebar-primary/0 group-hover:bg-sidebar-primary rounded-r transition-all duration-200" />
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary font-semibold">β</span>
              )}
            </a>
          ))}
        </nav>

        {/* User profile with premium styling */}
        <div className="relative z-10 px-4 py-4 border-t border-sidebar-border/50 bg-gradient-to-r from-sidebar-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-sidebar-primary/10 to-sidebar-primary/5 border border-sidebar-primary/20">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-orange-700 flex items-center justify-center text-sidebar-primary-foreground font-bold shadow-lg ring-2 ring-sidebar-primary/30">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">Service Advisor</p>
              <p className="text-xs text-sidebar-accent-foreground truncate">Active Now</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
