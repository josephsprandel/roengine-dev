"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, AlertTriangle, Clock, DollarSign } from "lucide-react"

export function MetricsGrid() {
  const metrics = [
    {
      label: "Total Revenue (Today)",
      value: "$12,450",
      change: "+12.5%",
      positive: true,
      icon: DollarSign,
      gradient: "from-green-500/20 to-emerald-500/20",
    },
    {
      label: "Open Repair Orders",
      value: "24",
      change: "+3 this hour",
      positive: true,
      icon: Clock,
      gradient: "from-blue-500/20 to-cyan-500/20",
    },
    {
      label: "Awaiting Customer Approval",
      value: "8",
      change: "-2 from yesterday",
      positive: true,
      icon: AlertTriangle,
      gradient: "from-amber-500/20 to-orange-500/20",
    },
    {
      label: "Avg Completion Time",
      value: "2.4 hrs",
      change: "-8.2% vs avg",
      positive: true,
      icon: TrendingUp,
      gradient: "from-purple-500/20 to-pink-500/20",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon
        return (
          <Card key={idx} className="relative overflow-hidden border-border">
            <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-50`} />
            <div className="relative p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</p>
                  <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
                </div>
                <div className="p-2 rounded-lg bg-card/50 border border-border">
                  <Icon size={20} className="text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400">{metric.change}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
