"use client"

import { Bell, Clock, AlertCircle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-gradient-to-r from-background via-background to-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-background/60 supports-[backdrop-filter]:via-background/60 supports-[backdrop-filter]:to-background/40">
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        {/* Voice-Enabled Search */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-3 ml-4">
          {/* Status indicator with premium styling */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-sm text-muted-foreground hover:border-border transition-colors group">
            <Clock className="w-4 h-4 group-hover:text-primary transition-colors" />
            <span>Shop: <span className="font-semibold text-foreground group-hover:text-primary transition-colors">Open</span></span>
          </div>

          {/* Notifications with enhanced styling */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative text-muted-foreground hover:text-foreground hover:bg-card/50 transition-all duration-200 group"
          >
            <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-gradient-to-br from-primary to-primary/70 rounded-full animate-pulse shadow-lg shadow-primary/50" />
          </Button>

          {/* Alert badge - Premium design */}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 gap-2 bg-transparent/50 backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-destructive/20 font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">3 Alerts</span>
          </Button>

          {/* AI Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 text-xs font-semibold text-primary group hover:border-primary/40 transition-colors cursor-default">
            <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  )
}
