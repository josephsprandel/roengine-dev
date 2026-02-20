"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lightning, TrendUp, Warning, Target, Lightbulb } from "@phosphor-icons/react"

interface Recommendation {
  id: string
  type: "opportunity" | "warning" | "suggestion" | "efficiency"
  title: string
  description: string
  action: string
  icon: React.ReactNode
  priority: "high" | "medium" | "low"
}

export function AIRecommendations() {
  const recommendations: Recommendation[] = [
    {
      id: "1",
      type: "opportunity",
      title: "Upsell Opportunity",
      description: "John Mitchell has high approval rate. Recommend premium diagnostic upgrade to RO-4521.",
      action: "Generate Estimate",
      icon: <TrendUp size={16} />,
      priority: "high",
    },
    {
      id: "2",
      type: "efficiency",
      title: "Batch Processing",
      description: "3 vehicles need brake service. Batch these ROs to improve efficiency by 35%.",
      action: "Batch ROs",
      icon: <Target size={16} />,
      priority: "high",
    },
    {
      id: "3",
      type: "warning",
      title: "Maintenance Alert",
      description: "Mike Chen's Ford F-150 is overdue for transmission service (95,400 miles).",
      action: "Schedule Service",
      icon: <Warning size={16} />,
      priority: "medium",
    },
    {
      id: "4",
      type: "suggestion",
      title: "Communication Timing",
      description: "Send follow-up SMS to Emma Rodriguez. Best response time: 2-4 PM based on history.",
      action: "Send SMS",
      icon: <Lightbulb size={16} />,
      priority: "low",
    },
  ]

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive bg-destructive/10 shrink-0">
            High
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 shrink-0">
            Med
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10 shrink-0">
            Low
          </Badge>
        )
    }
  }

  const getTypeIconColor = (type: string) => {
    switch (type) {
      case "opportunity":
        return "text-green-600 dark:text-green-400"
      case "warning":
        return "text-amber-600 dark:text-amber-400"
      case "efficiency":
        return "text-blue-600 dark:text-blue-400"
      default:
        return "text-muted-foreground"
    }
  }

  const getRowAccent = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-destructive/50"
      case "medium":
        return "border-l-amber-500/50"
      default:
        return "border-l-blue-500/50"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Lightning size={20} className="text-accent" />
          AI Recommendations
        </h2>
        <Badge className="bg-accent text-accent-foreground">4 Active</Badge>
      </div>

      <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className={`flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors border-l-2 ${getRowAccent(rec.priority)}`}
          >
            {/* Icon */}
            <div className={`${getTypeIconColor(rec.type)} shrink-0`}>{rec.icon}</div>

            {/* Title + Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground leading-tight">{rec.title}</span>
                {getPriorityBadge(rec.priority)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{rec.description}</p>
            </div>

            {/* Action button */}
            <Button size="sm" variant="outline" className="shrink-0 text-xs h-7 px-3">
              {rec.action}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        <span className="font-semibold text-foreground">Pro Tip:</span> The AI learns from your decisions. More
        actions you take lead to better recommendations.
      </p>
    </div>
  )
}
