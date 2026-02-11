import { Card } from "@/components/ui/card"
import { ChevronRight, LucideIcon } from "lucide-react"

export interface WorkflowStage {
  id: string
  label: string
  icon: LucideIcon
  active: boolean
  completed: boolean
}

interface StatusWorkflowProps {
  stages: WorkflowStage[]
}

export function StatusWorkflow({ stages }: StatusWorkflowProps) {
  return (
    <Card className="p-4 border-border">
      <div className="flex items-center justify-between overflow-x-auto">
        {stages.map((stage, idx) => {
          const Icon = stage.icon
          return (
            <div key={stage.id} className="flex items-center gap-3 flex-shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  stage.completed
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : stage.active
                      ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium whitespace-nowrap">{stage.label}</span>
              </div>
              {idx < stages.length - 1 && <ChevronRight size={16} className="text-border" />}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
