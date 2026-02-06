"use client"

import { Card } from "@/components/ui/card"
import { Zap, TrendingUp, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function AIInsights() {
  return (
    <Card className="p-6 border border-border bg-gradient-to-br from-card to-card/80 hover:border-opacity-100 transition-all">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Insights</h3>
        <Badge className="bg-gradient-to-r from-sidebar-primary to-orange-600 text-primary-foreground gap-1 border-0 shadow-lg">
          <Zap size={12} />
          Live
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex gap-3 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 hover:border-emerald-500/40 transition-colors group">
          <div className="flex-shrink-0">
            <div className="p-2 rounded-lg bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold text-foreground">Efficiency Spike Detected</p>
            <p className="text-xs text-muted-foreground mt-1">RO completion 18% faster today</p>
          </div>
        </div>

        <div className="flex gap-3 p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 hover:border-orange-500/40 transition-colors group">
          <div className="flex-shrink-0">
            <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors">
              <AlertCircle size={16} className="text-orange-400" />
            </div>
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold text-foreground">Customer Pattern</p>
            <p className="text-xs text-muted-foreground mt-1">High approval rate for this customer</p>
          </div>
        </div>

        <div className="flex gap-3 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 hover:border-cyan-500/40 transition-colors group">
          <div className="flex-shrink-0">
            <div className="p-2 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
              <Zap size={16} className="text-cyan-400" />
            </div>
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold text-foreground">Next Action Suggested</p>
            <p className="text-xs text-muted-foreground mt-1">Follow up on RO #4521 approval</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
