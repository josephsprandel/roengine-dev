"use client"

import { Card } from "@/components/ui/card"
import { TrendUp, Warning, Clock, CurrencyDollar } from "@phosphor-icons/react"

export function MetricsGrid() {
  const metrics = [
    {
      label: "Total Revenue (Today)",
      value: "$12,450",
      change: "+12.5%",
      positive: true,
      icon: CurrencyDollar,
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "Open Repair Orders",
      value: "24",
      change: "+3 this hour",
      positive: true,
      icon: Clock,
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Awaiting Customer Approval",
      value: "8",
      change: "-2 from yesterday",
      positive: true,
      icon: Warning,
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Avg Completion Time",
      value: "2.4 hrs",
      change: "-8.2% vs avg",
      positive: true,
      icon: TrendUp,
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon
        return (
          <Card key={idx} className="bg-slate-50 dark:bg-slate-900/50 border-border shadow-sm">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</p>
                  <h3 className="text-2xl font-bold text-foreground">{metric.value}</h3>
                </div>
                <div className="p-2 rounded-lg bg-card/50 border border-border">
                  <Icon size={20} className={metric.iconColor} />
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
