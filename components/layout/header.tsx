"use client"

import { Bell, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Voice-Enabled Search */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3 ml-4">
          {/* Status indicator with premium styling */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-sidebar-primary/10 to-transparent border border-sidebar-primary/20 text-sm font-medium text-foreground">
            <Clock size={16} className="text-sidebar-primary" />
            <span>Shop: Open</span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-sidebar-primary hover:bg-sidebar-primary/10 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
          </Button>

          {/* Alert badge with premium look */}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-2 bg-gradient-to-r from-destructive/5 to-transparent transition-all duration-200"
          >
            <AlertCircle size={16} />
            <span className="font-medium">3 Alerts</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
