"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ShopSettings } from "@/components/settings/shop-settings"
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
import { RecycleBinSettings } from "@/components/settings/recycle-bin-settings"
import { Settings, Building2, CreditCard, Palette, CalendarClock, ClipboardList, Truck, Trash2 } from "lucide-react"

const TABS = [
  { id: "shop", label: "Shop", icon: Building2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "business", label: "Business", icon: CreditCard },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "scheduling", label: "Scheduling", icon: CalendarClock },
  { id: "canned-jobs", label: "Canned Jobs", icon: ClipboardList },
  { id: "recycle-bin", label: "Recycle Bin", icon: Trash2 },
] as const

type TabId = (typeof TABS)[number]["id"]

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pt-8 first:pt-0">
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <div className="border-b border-border mb-6" />
    </div>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get("tab") as TabId) || "shop"

  const setTab = (tab: TabId) => {
    router.push(`/settings?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-muted">
          <Settings size={24} className="text-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure shop preferences and integrations
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="space-y-0">
        {activeTab === "shop" && (
          <>
            <SectionHeading title="Shop Profile" />
            <ShopSettings />
            <SectionHeading title="Team & Permissions" />
            <UsersSettings />
            <RolesSettings />
            <SectionHeading title="Email" />
            <EmailSettings />
          </>
        )}

        {activeTab === "appearance" && (
          <>
            <SectionHeading title="Appearance" />
            <AppearanceSettings />
            <SectionHeading title="User Interface" />
            <UISettings />
          </>
        )}

        {activeTab === "business" && (
          <>
            <SectionHeading title="Billing" />
            <BillingSettings />
            <SectionHeading title="Labor Rates" />
            <LaborRatesSettings />
            <SectionHeading title="Invoicing" />
            <InvoicingSettings />
            <SectionHeading title="Job States" />
            <JobStatesSettings />
          </>
        )}

        {activeTab === "vendors" && (
          <>
            <SectionHeading title="Vendor Preferences" />
            <VendorPreferencesSettings />
            <SectionHeading title="Vendors" />
            <VendorsSettings />
          </>
        )}

        {activeTab === "scheduling" && (
          <>
            <SchedulingSettings />
          </>
        )}

        {activeTab === "canned-jobs" && (
          <>
            <CannedJobsSettings />
          </>
        )}

        {activeTab === "recycle-bin" && (
          <>
            <RecycleBinSettings />
          </>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Suspense>
            <SettingsContent />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
