"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataSourcesSettings } from "@/components/settings/data-sources-settings"
import { ShopSettings } from "@/components/settings/shop-settings"
import { UserSettings } from "@/components/settings/user-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { AppearanceSettings } from "@/components/settings/appearance-settings"
import { LaborRatesSettings } from "@/components/settings/labor-rates-settings"
import { VendorPreferencesSettings } from "@/components/settings/vendor-preferences-settings"
import { RolesSettings } from "@/components/settings/roles-settings"
import { UsersSettings } from "@/components/settings/users-settings"
import { InvoicingSettings } from "@/components/settings/invoicing-settings"
import { SchedulingSettings } from "@/components/settings/scheduling-settings"
import { JobStatesSettings } from "@/components/settings/job-states-settings"
import { CannedJobsSettings } from "@/components/settings/canned-jobs-settings"
import { VendorsSettings } from "@/components/settings/vendors-settings"
import { EmailSettings } from "@/components/settings/email-settings"
import { UISettings } from "@/components/settings/ui-settings"
import { Settings, Database, Building2, Users, CreditCard, Palette, DollarSign, Package, Shield, UserCog, Receipt, CalendarClock, GitBranchPlus, ClipboardList, Truck, Mail, Monitor } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <Settings size={24} className="text-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Configure data sources, integrations, and shop preferences
                </p>
              </div>
            </div>

            {/* Settings Tabs */}
            <Tabs defaultValue="data-sources" className="space-y-6">
              <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
                <TabsTrigger
                  value="data-sources"
                  className="flex items-center gap-2 data-[state=active]:bg-background"
                >
                  <Database size={16} />
                  Data Sources
                </TabsTrigger>
                <TabsTrigger value="shop" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Building2 size={16} />
                  Shop Profile
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Users size={16} />
                  Team & Permissions
                </TabsTrigger>
                <TabsTrigger value="billing" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <CreditCard size={16} />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="appearance" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Palette size={16} />
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="labor-rates" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <DollarSign size={16} />
                  Labor Rates
                </TabsTrigger>
                <TabsTrigger value="vendor-preferences" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Package size={16} />
                  Vendor Preferences
                </TabsTrigger>
                <TabsTrigger value="invoicing" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Receipt size={16} />
                  Invoicing
                </TabsTrigger>
                <TabsTrigger value="scheduling" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <CalendarClock size={16} />
                  Scheduling
                </TabsTrigger>
                <TabsTrigger value="job-states" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <GitBranchPlus size={16} />
                  Job States
                </TabsTrigger>
                <TabsTrigger value="canned-jobs" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <ClipboardList size={16} />
                  Canned Jobs
                </TabsTrigger>
                <TabsTrigger value="vendors" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Truck size={16} />
                  Vendors
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Mail size={16} />
                  Email
                </TabsTrigger>
                <TabsTrigger value="user-interface" className="flex items-center gap-2 data-[state=active]:bg-background">
                  <Monitor size={16} />
                  User Interface
                </TabsTrigger>
              </TabsList>

              <TabsContent value="data-sources">
                <DataSourcesSettings />
              </TabsContent>

              <TabsContent value="shop">
                <ShopSettings />
              </TabsContent>

              <TabsContent value="users">
                <Tabs defaultValue="users-list" className="space-y-6">
                  <TabsList className="bg-muted/30">
                    <TabsTrigger value="users-list" className="flex items-center gap-2">
                      <UserCog size={14} />
                      Users
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="flex items-center gap-2">
                      <Shield size={14} />
                      Roles & Permissions
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="users-list">
                    <UsersSettings />
                  </TabsContent>
                  
                  <TabsContent value="roles">
                    <RolesSettings />
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="billing">
                <BillingSettings />
              </TabsContent>

              <TabsContent value="appearance">
                <AppearanceSettings />
              </TabsContent>

              <TabsContent value="labor-rates">
                <LaborRatesSettings />
              </TabsContent>

              <TabsContent value="vendor-preferences">
                <VendorPreferencesSettings />
              </TabsContent>

              <TabsContent value="invoicing">
                <InvoicingSettings />
              </TabsContent>

              <TabsContent value="scheduling">
                <SchedulingSettings />
              </TabsContent>

              <TabsContent value="job-states">
                <JobStatesSettings />
              </TabsContent>

              <TabsContent value="canned-jobs">
                <CannedJobsSettings />
              </TabsContent>

              <TabsContent value="vendors">
                <VendorsSettings />
              </TabsContent>

              <TabsContent value="email">
                <EmailSettings />
              </TabsContent>

              <TabsContent value="user-interface">
                <UISettings />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}
