"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Phone, Edit2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    { icon: Plus, label: "Create New RO", color: "text-emerald-400", accent: "emerald", onClick: () => router.push('/repair-orders/new') },
    { icon: FileText, label: "Generate Estimate", color: "text-purple-400", accent: "purple" },
    { icon: Phone, label: "Send SMS Update", color: "text-cyan-400", accent: "cyan" },
    { icon: Edit2, label: "Edit Active RO", color: "text-orange-400", accent: "orange" },
  ]

  return (
    <>
      <Card className="p-6 border border-border bg-gradient-to-br from-card to-card/80 hover:border-opacity-100 transition-all">
        <h3 className="text-xs font-bold text-muted-foreground mb-6 uppercase tracking-widest">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, idx) => {
            const Icon = action.icon
            return (
              <Button
                key={idx}
                variant="outline"
                className={`h-auto flex flex-col items-center justify-center gap-3 py-5 px-3 border border-border/50 hover:border-${action.accent}-500/30 bg-gradient-to-br from-card to-transparent hover:from-${action.accent}-500/10 transition-all duration-300 group`}
                onClick={action.onClick}
              >
                <div className={`p-2 rounded-lg bg-${action.accent}-500/10 group-hover:bg-${action.accent}-500/20 transition-colors`}>
                  <Icon className={`${action.color}`} size={20} />
                </div>
                <span className="text-xs font-semibold text-foreground text-center leading-tight">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </Card>

    </>
  )
}
