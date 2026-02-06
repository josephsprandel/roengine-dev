"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SparklesIcon as Sparkles, DocumentDuplicateIcon as Copy, PaperAirplaneIcon as Send, PencilSquareIcon as Edit2 } from "@heroicons/react/24/outline"

export function AIEstimateGenerator() {
  const [estimate, setEstimate] = useState({
    labor: 450,
    parts: 800,
    tax: 100,
    total: 1350,
    confidence: "95%",
    reasoning:
      "Based on 2022 Tesla Model 3, battery diagnostic service complexity level 8/10, local market rates, and your historical pricing for similar services.",
  })

  const [isEditing, setIsEditing] = useState(false)

  return (
    <Card className="p-6 border-border bg-gradient-to-br from-accent/10 to-blue-600/10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-accent" />
          <h2 className="text-lg font-semibold text-foreground">AI-Generated Estimate</h2>
        </div>
        <Badge className="bg-accent text-accent-foreground gap-1">
          <span className="w-2 h-2 bg-accent-foreground rounded-full animate-pulse" />
          {estimate.confidence} Confidence
        </Badge>
      </div>

      {/* Estimate breakdown */}
      <div className="space-y-3 mb-4 p-4 bg-card border border-border rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Labor (2 hrs @ $225/hr)</span>
          <span className="font-semibold text-foreground">${estimate.labor.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Parts & Materials</span>
          <span className="font-semibold text-foreground">${estimate.parts.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax (8%)</span>
          <span className="font-semibold text-foreground">${estimate.tax.toLocaleString()}</span>
        </div>
        <div className="border-t border-border pt-3 flex justify-between text-base">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-lg font-bold text-accent">${estimate.total.toLocaleString()}</span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="p-3 bg-muted/30 rounded-lg border border-border mb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">AI Reasoning:</span> {estimate.reasoning}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-2">
          <Send size={16} />
          Send to Customer
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-2 bg-transparent"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit2 size={16} />
          Adjust
        </Button>
        <Button size="sm" variant="outline" className="gap-2 bg-transparent">
          <Copy size={16} />
        </Button>
      </div>
    </Card>
  )
}
