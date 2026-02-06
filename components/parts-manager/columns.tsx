"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowsUpDownIcon as ArrowUpDown } from "@heroicons/react/24/outline"

export interface Part {
  id: number
  part_number: string
  description: string
  vendor: string
  cost: number
  price: number
  quantity_on_hand: number
  quantity_available: number
  quantity_allocated: number
  reorder_point: number
  location: string
  bin_location: string | null
  category: string
  notes: string | null
  approvals: string | null
  shopware_id: string | null
  last_synced_at: string | null
  last_updated: string
  created_at: string
}

function getStockStatus(qty: number, reorderPoint: number) {
  if (qty === 0) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' }
  if (qty <= reorderPoint) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' }
  return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' }
}

export const columns: ColumnDef<Part>[] = [
  {
    accessorKey: "part_number",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Part Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="font-mono text-foreground">{row.getValue("part_number")}</div>
    ),
  },
  {
    accessorKey: "description",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Description
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-foreground max-w-xs truncate" title={row.getValue("description")}>
        {row.getValue("description")}
      </div>
    ),
  },
  {
    accessorKey: "quantity_available",
    header: ({ column }) => {
      return (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Qty Available
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const qty = row.getValue("quantity_available") as number
      const reorderPoint = row.original.reorder_point
      const status = getStockStatus(qty, reorderPoint)
      
      return (
        <div className="text-center">
          <span className={`px-3 py-1 rounded-full font-medium text-sm ${status.bg} ${status.text}`}>
            {qty}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "reorder_point",
    header: () => <div className="text-center">Reorder</div>,
    cell: ({ row }) => (
      <div className="text-center text-muted-foreground">
        {row.getValue("reorder_point")}
      </div>
    ),
  },
  {
    accessorKey: "location",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Location
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-foreground">
        {row.getValue("location")}
        {row.original.bin_location && (
          <span className="text-xs text-muted-foreground ml-1">
            • {row.original.bin_location}
          </span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "vendor",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-8 px-2"
        >
          Vendor
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <div className="text-foreground">{row.getValue("vendor")}</div>
    ),
  },
  {
    accessorKey: "cost",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Cost
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const cost = parseFloat(row.getValue("cost"))
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(cost)
      
      return <div className="text-right text-foreground">{formatted}</div>
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2"
          >
            Retail
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("price"))
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(price)
      
      return <div className="text-right text-foreground">{formatted}</div>
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Actions</div>,
    cell: ({ row }) => {
      const part = row.original
      
      return (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-7 bg-transparent">
            Add to RO
          </Button>
          {part.quantity_available <= part.reorder_point && (
            <Button size="sm" variant="outline" className="h-7 bg-transparent text-amber-600">
              Reorder
            </Button>
          )}
        </div>
      )
    },
  },
]
