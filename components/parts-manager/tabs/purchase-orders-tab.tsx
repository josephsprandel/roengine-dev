"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PlusIcon as Plus } from "@heroicons/react/24/outline"

export function PurchaseOrdersTab() {
  const orders = [
    { id: "PO-2024-001", vendor: "NAPA Auto", items: 12, total: "$2,450.00", status: "Ordered", date: "Jan 20" },
    { id: "PO-2024-002", vendor: "O'Reilly Auto", items: 8, total: "$1,890.00", status: "Received", date: "Jan 19" },
    { id: "PO-2024-003", vendor: "SSF FRAN", items: 5, total: "$890.50", status: "Draft", date: "Jan 18" },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="flex gap-2 flex-1 mr-4">
          <Input placeholder="Search PO number..." className="bg-card border-border" />
        </div>
        <Button className="gap-2">
          <Plus size={16} />
          New PO
        </Button>
      </div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO Number</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Items</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border hover:bg-card/50">
                <td className="px-4 py-3 font-mono text-foreground">{order.id}</td>
                <td className="px-4 py-3 text-foreground">{order.vendor}</td>
                <td className="px-4 py-3 text-center text-foreground">{order.items}</td>
                <td className="px-4 py-3 text-right text-foreground font-medium">{order.total}</td>
                <td className="px-4 py-3">
                  <Badge variant={order.status === "Ordered" ? "default" : "secondary"}>{order.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{order.date}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" className="h-7 bg-transparent">
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
