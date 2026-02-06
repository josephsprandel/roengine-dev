"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BoltIcon as Zap, ArrowUpIcon as TrendingUp, ExclamationTriangleIcon as AlertTriangle, CheckBadgeIcon as Target, LightBulbIcon as Lightbulb } from "@heroicons/react/24/outline"

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
      icon: <TrendingUp size={20} />,
      priority: "high",
    },
    {
      id: "2",
      type: "efficiency",
      title: "Batch Processing",
      description: "3 vehicles need brake service. Batch these ROs to improve efficiency by 35%.",
      action: "Batch ROs",
      icon: <Target size={20} />,
      priority: "high",
    },
    {
      id: "3",
      type: "warning",
      title: "Maintenance Alert",
      description: "Mike Chen's Ford F-150 is overdue for transmission service (95,400 miles).",
      action: "Schedule Service",
      icon: <AlertTriangle size={20} />,
      priority: "medium",
    },
    {
      id: "4",
      type: "suggestion",
      title: "Communication Timing",
      description: "Send follow-up SMS to Emma Rodriguez. Best response time: 2-4 PM based on history.",
      action: "Send SMS",
      icon: <Lightbulb size={20} />,
      priority: "low",
    },
  ]

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 border-destructive/30 text-destructive"
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
      default:
        return "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
    }
  }

  const getTypeIcon = (type: string) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Zap size={20} className="text-accent" />
          AI Recommendations
        </h2>
        <Badge className="bg-accent text-accent-foreground">4 Active</Badge>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <Card key={rec.id} className={`p-4 border-2 ${getPriorityColor(rec.priority)}`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`${getTypeIcon(rec.type)} flex-shrink-0`}>{rec.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{rec.title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{rec.description}</p>
              </div>
            </div>
            <Button size="sm" className="w-full">
              {rec.action}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-4 border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Pro Tip:</span> The AI learns from your decisions. More
          actions you take lead to better recommendations.
        </p>
      </Card>
    </div>
  )
}
