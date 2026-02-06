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
      accentColor: "text-emerald-400",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Open Repair Orders",
      value: "24",
      change: "+3 this hour",
      positive: true,
      icon: Clock,
      accentColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
    },
    {
      label: "Awaiting Customer Approval",
      value: "8",
      change: "-2 from yesterday",
      positive: true,
      icon: AlertTriangle,
      accentColor: "text-orange-400",
      borderColor: "border-orange-500/20",
    },
    {
      label: "Avg Completion Time",
      value: "2.4 hrs",
      change: "-8.2% vs avg",
      positive: true,
      icon: TrendingUp,
      accentColor: "text-purple-400",
      borderColor: "border-purple-500/20",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon
        return (
          <Card
            key={idx}
            className={`relative overflow-hidden border ${metric.borderColor} bg-gradient-to-br from-card to-card/80 hover:border-opacity-100 transition-all duration-300 hover:shadow-lg group`}
          >
            {/* Accent line top */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${metric.accentColor} opacity-50 group-hover:opacity-100 transition-opacity`} />
            
            {/* Background gradient accent */}
            <div className={`absolute -top-12 -right-12 w-24 h-24 rounded-full ${metric.accentColor} opacity-5 group-hover:opacity-10 transition-opacity`} />
            
            <div className="relative p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{metric.label}</p>
                  <h3 className="text-3xl font-bold text-foreground">{metric.value}</h3>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br from-card to-card/60 border ${metric.borderColor} group-hover:border-opacity-100 transition-all`}>
                  <Icon size={20} className={metric.accentColor} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-muted to-transparent" />
                <p className="text-xs font-semibold text-emerald-400">{metric.change}</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
