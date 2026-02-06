"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CreditCardIcon as CreditCard, ArrowDownTrayIcon as Download, BoltIcon as Zap, CheckIcon as Check, ArrowTopRightOnSquareIcon as ArrowUpRight } from "@heroicons/react/24/outline"

export function BillingSettings() {
  const currentPlan = {
    name: "Professional",
    price: 199,
    interval: "month",
    features: [
      "Unlimited Repair Orders",
      "Up to 10 Team Members",
      "AI Assistant (5,000 queries/mo)",
      "3 Data Source Integrations",
      "SMS & Email Communications",
      "Standard Support",
    ],
  }

  const usage = {
    repairOrders: { used: 847, limit: "Unlimited" },
    aiQueries: { used: 3241, limit: 5000 },
    teamMembers: { used: 5, limit: 10 },
    integrations: { used: 2, limit: 3 },
  }

  const invoices = [
    { id: "INV-2024-001", date: "Jan 1, 2024", amount: 199, status: "paid" },
    { id: "INV-2023-012", date: "Dec 1, 2023", amount: 199, status: "paid" },
    { id: "INV-2023-011", date: "Nov 1, 2023", amount: 199, status: "paid" },
    { id: "INV-2023-010", date: "Oct 1, 2023", amount: 149, status: "paid" },
  ]

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className="p-6 border-border bg-gradient-to-br from-accent/5 to-transparent">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={20} className="text-accent" />
              <h3 className="text-lg font-semibold text-foreground">Current Plan</h3>
              <Badge className="bg-accent/20 text-accent">{currentPlan.name}</Badge>
            </div>
            <p className="text-3xl font-bold text-foreground">
              ${currentPlan.price}
              <span className="text-base font-normal text-muted-foreground">/{currentPlan.interval}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">Next billing date: February 1, 2024</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">Change Plan</Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {currentPlan.features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
              <Check size={14} className="text-accent shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </Card>

      {/* Usage */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Current Usage</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Repair Orders</span>
              <span className="text-muted-foreground">{usage.repairOrders.used} / {usage.repairOrders.limit}</span>
            </div>
            <Progress value={100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">AI Queries</span>
              <span className="text-muted-foreground">
                {usage.aiQueries.used.toLocaleString()} / {usage.aiQueries.limit.toLocaleString()}
              </span>
            </div>
            <Progress value={(usage.aiQueries.used / usage.aiQueries.limit) * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Team Members</span>
              <span className="text-muted-foreground">{usage.teamMembers.used} / {usage.teamMembers.limit}</span>
            </div>
            <Progress value={(usage.teamMembers.used / usage.teamMembers.limit) * 100} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Data Integrations</span>
              <span className="text-muted-foreground">{usage.integrations.used} / {usage.integrations.limit}</span>
            </div>
            <Progress value={(usage.integrations.used / usage.integrations.limit) * 100} className="h-2" />
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            You've used 65% of your AI queries this month. Consider upgrading to Enterprise for unlimited queries.
          </p>
        </div>
      </Card>

      {/* Payment Method */}
      <Card className="p-6 border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">Payment Method</h3>
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-800 flex items-center justify-center">
              <CreditCard size={18} className="text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">Visa ending in 4242</p>
              <p className="text-sm text-muted-foreground">Expires 12/2025</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Update
          </Button>
        </div>
      </Card>

      {/* Billing History */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Billing History</h3>
          <Button variant="ghost" size="sm" className="text-accent">
            View All
            <ArrowUpRight size={14} className="ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Download size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{invoice.id}</p>
                  <p className="text-sm text-muted-foreground">{invoice.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-foreground">${invoice.amount}</span>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Paid</Badge>
                <Button variant="ghost" size="sm">
                  <Download size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Upgrade CTA */}
      <Card className="p-6 border-accent/50 bg-gradient-to-br from-accent/10 to-blue-600/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Upgrade to Enterprise</h3>
            <p className="text-muted-foreground">
              Unlimited AI queries, unlimited integrations, priority support, and custom features.
            </p>
          </div>
          <Button className="bg-accent hover:bg-accent/90">
            Contact Sales
            <ArrowUpRight size={14} className="ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
