"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CubeIcon as Package, ExclamationTriangleIcon as AlertTriangle, ShoppingCartIcon as ShoppingCart, TruckIcon as Truck, UsersIcon as Users, ArrowPathIcon as RotateCcw, PlusIcon as Plus, MagnifyingGlassIcon as Search, FunnelIcon as Filter, ArrowTopRightOnSquareIcon as ExternalLink, PhotoIcon as Camera } from "@heroicons/react/24/outline"
import { PartsInventoryTab } from "./tabs/parts-inventory-tab"
import { PurchaseOrdersTab } from "./tabs/purchase-orders-tab"
import { ReceivingTab } from "./tabs/receiving-tab"
import { VendorManagementTab } from "./tabs/vendor-management-tab"
import { CoresTrackingTab } from "./tabs/cores-tracking-tab"
import Link from "next/link"

export function PartsManagerDashboard() {
  const [activeTab, setActiveTab] = useState("inventory")

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Parts Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage inventory, orders, vendors, and cores</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/scan-specs">
            <Button size="lg" variant="outline" className="gap-2">
              <Camera size={18} />
              Scan Specs
            </Button>
          </Link>
          <Link href="/parts-search">
            <Button size="lg" variant="outline" className="gap-2">
              <Search size={18} />
              PartsTech Search
              <ExternalLink size={14} className="opacity-50" />
            </Button>
          </Link>
          <Button size="lg" className="gap-2">
            <Plus size={18} />
            New Part
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package size={16} />
              Total Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">$110,690</div>
            <p className="text-xs text-muted-foreground mt-1">2,847 parts in stock</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-red-50/5 dark:bg-red-950/10 border-red-200/50 dark:border-red-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle size={16} />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">23</div>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">Below minimum quantity</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-amber-50/5 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <ShoppingCart size={16} />
              Pending POs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">7</div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">$8,450 on order</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-green-50/5 dark:bg-green-950/10 border-green-200/50 dark:border-green-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
              <RotateCcw size={16} />
              Core Returns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">$2,340</div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">Available credit</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card className="flex flex-col flex-1 min-h-0 border-border">
        <CardHeader className="border-b border-border pb-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-transparent border-b border-border rounded-none p-0 h-auto">
              <TabsTrigger
                value="inventory"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
              >
                <Package size={16} className="mr-2" />
                Inventory
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
              >
                <ShoppingCart size={16} className="mr-2" />
                Purchase Orders
              </TabsTrigger>
              <TabsTrigger
                value="receiving"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
              >
                <Truck size={16} className="mr-2" />
                Receiving
              </TabsTrigger>
              <TabsTrigger
                value="vendors"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
              >
                <Users size={16} className="mr-2" />
                Vendors
              </TabsTrigger>
              <TabsTrigger
                value="cores"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
              >
                <RotateCcw size={16} className="mr-2" />
                Cores
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 min-h-0 pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsContent value="inventory">
              <PartsInventoryTab />
            </TabsContent>
            <TabsContent value="orders">
              <PurchaseOrdersTab />
            </TabsContent>
            <TabsContent value="receiving">
              <ReceivingTab />
            </TabsContent>
            <TabsContent value="vendors">
              <VendorManagementTab />
            </TabsContent>
            <TabsContent value="cores">
              <CoresTrackingTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
