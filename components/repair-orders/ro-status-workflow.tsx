"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckIcon as Check, ExclamationCircleIcon as AlertCircle, ClockIcon as Clock, CheckCircleIcon as CheckCircle2 } from "@heroicons/react/24/outline"

export function ROStatusWorkflow() {
  const stages = [
    {
      id: "intake",
      label: "Intake",
      description: "RO Created",
      icon: AlertCircle,
      active: false,
      completed: true,
    },
    {
      id: "diagnostic",
      label: "Diagnostic",
      description: "In Progress",
      icon: Clock,
      active: true,
      completed: false,
    },
    {
      id: "approval",
      label: "Customer Approval",
      description: "Awaiting",
      icon: AlertCircle,
      active: false,
      completed: false,
    },
    {
      id: "service",
      label: "Service Work",
      description: "Pending",
      icon: Clock,
      active: false,
      completed: false,
    },
    {
      id: "completion",
      label: "Completion",
      description: "Ready",
      icon: CheckCircle2,
      active: false,
      completed: false,
    },
  ]

  return (
    <Card className="p-6 border-border">
      <h2 className="text-lg font-semibold text-foreground mb-6">Status Workflow</h2>

      <div className="space-y-4">
        {stages.map((stage, idx) => {
          const Icon = stage.icon
          return (
            <div key={stage.id}>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`mt-1 p-2 rounded-lg flex-shrink-0 ${
                    stage.completed
                      ? "bg-green-500/20 text-green-600 dark:text-green-400"
                      : stage.active
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {stage.completed ? <Check size={20} /> : <Icon size={20} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{stage.label}</h3>
                    {stage.active && (
                      <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20">Now</Badge>
                    )}
                    {stage.completed && (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20">
                        Done
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>

                {/* Action button */}
                {stage.active && (
                  <Button size="sm" className="flex-shrink-0">
                    Next
                  </Button>
                )}
              </div>

              {/* Connector */}
              {idx < stages.length - 1 && <div className="ml-6 h-6 border-l-2 border-border mt-2" />}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
