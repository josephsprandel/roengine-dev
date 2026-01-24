"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X, Wrench, LayoutDashboard, Users, MessageSquare, Settings, Zap, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Wrench, label: "Repair Orders", href: "/repair-orders" },
    { icon: Users, label: "Customers", href: "/customers" },
    { icon: MessageSquare, label: "Communications", href: "#" },
    { icon: BarChart3, label: "Analytics", href: "#" },
    { icon: Zap, label: "AI Assistant", href: "/ai-assistant", beta: true },
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
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary to-blue-600 flex items-center justify-center">
            <Wrench size={24} className="text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground">RO Engine</h1>
            <p className="text-xs text-sidebar-accent-foreground">AI Powered</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium",
                "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.beta && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary">β</span>
              )}
            </Link>
          ))}
        </nav>

        {/* User profile */}
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sidebar-primary to-blue-600 flex items-center justify-center text-sidebar-primary-foreground font-bold">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">Service Advisor</p>
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
