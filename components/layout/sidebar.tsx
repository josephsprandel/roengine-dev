"use client"

import { useState, useEffect } from "react"
import { Bars3Icon as Menu, XMarkIcon as X, WrenchIcon as Wrench, HomeIcon as LayoutDashboard, UsersIcon as Users, ChatBubbleBottomCenterTextIcon as MessageSquare, Cog6ToothIcon as Settings, BoltIcon as Zap, BarChartIcon as BarChart3, CubeIcon as Package, TrashIcon as Trash2 } from "@heroicons/react/24/outline"
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
        className="fixed left-4 top-4 z-40 lg:hidden p-2 rounded-md bg-sidebar text-sidebar-foreground border border-sidebar-border hover:bg-sidebar-accent transition-colors"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gradient-to-b from-sidebar via-sidebar to-sidebar border-r border-sidebar-border transition-transform duration-300 lg:translate-x-0 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Top accent line */}
        <div className="h-1 bg-gradient-to-r from-sidebar-primary via-sidebar-primary/60 to-transparent" />

        {/* Logo Section - Premium Design */}
        <div className="px-6 py-8 border-b border-sidebar-border/40">
          <div className="flex items-center gap-3 mb-2">
            {shopLogo ? (
              <Image
                src={shopLogo}
                alt={shopName}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-contain ring-2 ring-sidebar-primary/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 flex items-center justify-center ring-2 ring-sidebar-primary/30">
                <Wrench size={22} className="text-sidebar-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm text-sidebar-foreground leading-tight">{shopName}</h1>
              <p className="text-xs text-sidebar-accent-foreground/70 font-medium tracking-wide">AI POWERED</p>
            </div>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-sidebar-primary/40 via-sidebar-primary/20 to-transparent rounded-full mt-3" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item, idx) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium relative group",
                "text-sidebar-foreground/80 hover:text-sidebar-foreground",
                "hover:bg-sidebar-accent/60 hover:border-l-2 hover:border-l-sidebar-primary hover:pl-3.5",
                "focus:outline-none focus:ring-2 focus:ring-sidebar-primary/40 focus:ring-inset"
              )}
              style={{
                animationDelay: `${idx * 30}ms`,
              }}
            >
              <item.icon size={18} className="flex-shrink-0 transition-transform group-hover:scale-110" />
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-sidebar-primary/30 to-sidebar-primary/10 text-sidebar-primary font-semibold">β</span>
              )}
            </a>
          ))}
        </nav>

        {/* User profile - Premium card */}
        <div className="px-3 py-4 border-t border-sidebar-border/40">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-sidebar-primary/15 to-sidebar-primary/5 border border-sidebar-primary/20 hover:border-sidebar-primary/40 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/60 flex items-center justify-center text-sidebar-primary-foreground font-bold text-xs ring-2 ring-sidebar-primary/30 flex-shrink-0">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">Service Advisor</p>
              <p className="text-xs text-sidebar-accent-foreground/70 truncate">Active Now</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
