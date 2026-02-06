"use client"

import { Card } from "@/components/ui/card"
import { BoltIcon as Zap, ArrowUpIcon as TrendingUp, ExclamationCircleIcon as AlertCircle } from "@heroicons/react/24/outline"
import { Badge } from "@/components/ui/badge"

export function AIInsights() {
  return (
    <Card className="p-6 border-border bg-gradient-to-br from-card to-card/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">AI INSIGHTS</h3>
        <Badge className="bg-accent text-accent-foreground gap-1">
          <Zap size={12} />
          Live
        </Badge>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <TrendingUp size={16} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Efficiency Spike Detected</p>
            <p className="text-xs text-muted-foreground">RO completion 18% faster today</p>
          </div>
        </div>

        <div className="flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Customer Pattern</p>
            <p className="text-xs text-muted-foreground">High approval rate for this customer</p>
          </div>
        </div>

        <div className="flex gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <Zap size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Next Action Suggested</p>
            <p className="text-xs text-muted-foreground">Follow up on RO #4521 approval</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
