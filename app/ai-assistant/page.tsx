"use client"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkle, Brain, Lightning, ChatCircle, TrendUp } from "@phosphor-icons/react"
import { AIRecommendations } from "@/components/ai/ai-recommendations"
import { AIEstimateGenerator } from "@/components/ai/ai-estimate-generator"

export default function AIAssistantPage() {
  const capabilities = [
    {
      icon: Brain,
      title: "Smart Analysis",
      description: "Analyze vehicle history, service patterns, and customer data",
    },
    {
      icon: TrendUp,
      title: "Predictive Insights",
      description: "Identify upsell opportunities and maintenance needs",
    },
    {
      icon: ChatCircle,
      title: "Auto-Messaging",
      description: "Generate personalized customer communications",
    },
    {
      icon: Lightning,
      title: "Workflow Optimization",
      description: "Suggest efficiency improvements and scheduling",
    },
  ]

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-lg bg-gradient-to-br from-accent to-blue-600">
                  <Sparkle size={24} className="text-accent-foreground" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">RO Engine AI Assistant</h1>
                  <p className="text-sm text-muted-foreground">Powered by advanced machine learning for your shop</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Current context */}
                <Card className="p-6 border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Current Context</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Working with</p>
                      <p className="text-lg font-semibold text-foreground">
                        RO-4521 • John Mitchell • 2022 Tesla Model 3
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400">Battery Diagnostic</Badge>
                      <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Awaiting Approval</Badge>
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">High-Value Customer</Badge>
                    </div>
                  </div>
                </Card>

                {/* Estimate Generator */}
                <AIEstimateGenerator />

                {/* Capabilities */}
                <Card className="p-6 border-border">
                  <h2 className="text-lg font-semibold text-foreground mb-4">AI Capabilities</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {capabilities.map((cap, idx) => {
                      const Icon = cap.icon
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                        >
                          <Icon size={20} className="text-accent mb-2" />
                          <h3 className="font-semibold text-foreground text-sm mb-1">{cap.title}</h3>
                          <p className="text-xs text-muted-foreground">{cap.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <AIRecommendations />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
