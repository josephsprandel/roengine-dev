"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, DocumentIcon, PhoneIcon, PencilSquareIcon as Edit2 } from "@heroicons/react/24/outline"
import { useRouter } from "next/navigation"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    { icon: Plus, label: "Create New RO", color: "text-blue-500", onClick: () => router.push('/repair-orders/new') },
    { icon: FileText, label: "Generate Estimate", color: "text-purple-500" },
    { icon: Phone, label: "Send SMS Update", color: "text-green-500" },
    { icon: Edit2, label: "Edit Active RO", color: "text-orange-500" },
  ]

  return (
    <>
      <Card className="p-6 border-border">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4">QUICK ACTIONS</h3>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, idx) => {
            const Icon = action.icon
            return (
              <Button
                key={idx}
                variant="outline"
                className="h-auto flex flex-col items-center justify-center gap-2 py-4 border-border hover:bg-accent hover:text-accent-foreground bg-transparent"
                onClick={action.onClick}
              >
                <Icon className={`${action.color}`} size={24} />
                <span className="text-xs font-medium text-center">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </Card>

    </>
  )
}
