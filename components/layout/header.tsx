"use client"

import { Bell, Clock, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Voice-Enabled Search */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4 ml-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
            <Clock size={16} />
            <span>Shop: Open</span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
          </Button>

          {/* Alert badge */}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2 bg-transparent"
          >
            <WarningCircle size={16} />
            <span>3 Alerts</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
