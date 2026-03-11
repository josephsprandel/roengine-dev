"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useState, useRef, useEffect, useCallback } from "react"
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
import { PaymentMethodsSettings } from "@/components/settings/payment-methods-settings"
import { PhoneAssistantSettings } from "@/components/settings/phone-assistant-settings"
import { DecalDesignerSettings } from "@/components/decal-designer/DecalDesignerSettings"
import { Settings, Building2, CreditCard, Palette, CalendarClock, ClipboardList, Truck, Trash2, Phone, Search, Tag } from "lucide-react"

const TABS = [
  { id: "shop", label: "Shop", icon: Building2 },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "business", label: "Business", icon: CreditCard },
  { id: "vendors", label: "Vendors", icon: Truck },
  { id: "scheduling", label: "Scheduling", icon: CalendarClock },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "canned-jobs", label: "Canned Jobs", icon: ClipboardList },
  { id: "recycle-bin", label: "Recycle Bin", icon: Trash2 },
  { id: "decal-designer", label: "Decal Designer", icon: Tag },
] as const

type TabId = (typeof TABS)[number]["id"]

interface SearchEntry {
  terms: string[]
  tab: TabId
  section: string
  label: string
}

const SEARCH_INDEX: SearchEntry[] = [
  // Shop
  { terms: ["shop name", "business name", "dba"], tab: "shop", section: "Shop Profile", label: "Shop Name" },
  { terms: ["logo", "shop logo", "branding", "image"], tab: "shop", section: "Shop Profile", label: "Shop Logo" },
  { terms: ["address", "street", "city", "state", "zip", "location"], tab: "shop", section: "Shop Profile", label: "Address" },
  { terms: ["phone", "phone number", "shop phone"], tab: "shop", section: "Shop Profile", label: "Phone Number" },
  { terms: ["desk phone", "click to call", "call bridge"], tab: "shop", section: "Shop Profile", label: "Desk Phone" },
  { terms: ["telnyx", "ro engine phone", "telnyx phone"], tab: "shop", section: "Shop Profile", label: "RO Engine Phone Number" },
  { terms: ["hours", "operating hours", "business hours", "open", "close", "schedule"], tab: "shop", section: "Shop Profile", label: "Operating Hours" },
  { terms: ["timezone", "time zone", "tz"], tab: "shop", section: "Shop Profile", label: "Timezone" },
  { terms: ["oil change", "oil interval", "oil presets", "oci"], tab: "shop", section: "Shop Profile", label: "Oil Change Presets" },
  { terms: ["decal", "decal designer", "label designer", "oil decal", "zpl", "sticker", "label"], tab: "decal-designer", section: "Decal Designer", label: "Decal Designer" },
  { terms: ["services", "specialties", "tags", "description"], tab: "shop", section: "Shop Profile", label: "Services & Tags" },
  { terms: ["team", "users", "staff", "permissions", "employees"], tab: "shop", section: "Team & Permissions", label: "Team & Users" },
  { terms: ["roles", "admin", "technician", "advisor", "permissions"], tab: "shop", section: "Team & Permissions", label: "Roles" },
  { terms: ["email", "smtp", "imap", "mail", "email configuration"], tab: "shop", section: "Email", label: "Email / SMTP / IMAP" },
  // Appearance
  { terms: ["theme", "color", "color theme", "accent"], tab: "appearance", section: "Appearance", label: "Color Theme" },
  { terms: ["dark mode", "light mode", "appearance mode", "night"], tab: "appearance", section: "Appearance", label: "Dark / Light Mode" },
  { terms: ["accessibility", "contrast", "font size"], tab: "appearance", section: "Appearance", label: "Accessibility" },
  { terms: ["ui", "user interface", "interface", "layout"], tab: "appearance", section: "User Interface", label: "User Interface" },
  // Business
  { terms: ["tax", "tax rate", "sales tax"], tab: "business", section: "Invoicing", label: "Tax Rate" },
  { terms: ["labor rate", "labor rates", "hourly rate"], tab: "business", section: "Labor Rates", label: "Labor Rates" },
  { terms: ["parts markup", "markup", "parts"], tab: "shop", section: "Shop Profile", label: "Parts Markup" },
  { terms: ["invoice", "invoicing", "ro number", "ro numbering", "numbering"], tab: "business", section: "Invoicing", label: "RO Numbering" },
  { terms: ["shop supplies", "supplies fee", "shop fee"], tab: "business", section: "Invoicing", label: "Shop Supplies" },
  { terms: ["credit card", "cc surcharge", "surcharge", "card fee"], tab: "business", section: "Invoicing", label: "CC Surcharge" },
  { terms: ["billing", "plan", "subscription", "usage"], tab: "business", section: "Billing", label: "Billing & Plan" },
  { terms: ["payment", "payment methods", "accepted payments"], tab: "business", section: "Payment Methods", label: "Payment Methods" },
  { terms: ["payroll", "payroll frequency", "pay period"], tab: "business", section: "Billing", label: "Payroll" },
  { terms: ["job states", "workflow", "pipeline", "state"], tab: "business", section: "Job States", label: "Job States Pipeline" },
  // Vendors
  { terms: ["vendor", "vendors", "vendor list", "supplier"], tab: "vendors", section: "Vendors", label: "Vendor List" },
  { terms: ["worldpac", "vendor preferences", "preferred vendor", "parts vendor"], tab: "vendors", section: "Vendor Preferences", label: "Vendor Preferences" },
  // Scheduling
  { terms: ["booking", "online booking", "appointments", "scheduling"], tab: "scheduling", section: "Scheduling", label: "Online Booking" },
  { terms: ["waiter", "waiters", "max waiters", "waiter cutoff"], tab: "scheduling", section: "Scheduling", label: "Waiter Settings" },
  { terms: ["drop-off", "dropoff", "drop off", "dropoff slots", "max dropoffs"], tab: "scheduling", section: "Scheduling", label: "Drop-off Settings" },
  { terms: ["lead time", "advance booking", "booking window"], tab: "scheduling", section: "Scheduling", label: "Lead Time & Booking Window" },
  { terms: ["rules", "scheduling rules", "rules engine", "capacity"], tab: "scheduling", section: "Scheduling", label: "Rules Engine" },
  // Phone
  { terms: ["phone assistant", "ai phone", "retell", "phone agent", "voice"], tab: "phone", section: "Phone Assistant", label: "Phone Assistant" },
  { terms: ["greeting", "phone greeting", "answer", "hello"], tab: "phone", section: "Phone Assistant", label: "Greeting" },
  { terms: ["personality", "tone", "voice personality", "aggression"], tab: "phone", section: "Phone Assistant", label: "Personality" },
  { terms: ["phone script", "prompt", "system prompt"], tab: "phone", section: "Phone Assistant", label: "Phone Script" },
  // Canned Jobs
  { terms: ["canned jobs", "job templates", "templates", "preset jobs", "common jobs"], tab: "canned-jobs", section: "Canned Jobs", label: "Canned Job Templates" },
]

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

  const [searchQuery, setSearchQuery] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const pendingScroll = useRef<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const setTab = (tab: TabId) => {
    router.push(`/settings?tab=${tab}`, { scroll: false })
  }

  // Filter search results
  const searchResults = searchQuery.length >= 2
    ? SEARCH_INDEX.filter((entry) =>
        entry.terms.some((term) => term.includes(searchQuery.toLowerCase()))
      ).slice(0, 6)
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Scroll to section after tab change
  useEffect(() => {
    if (!pendingScroll.current) return
    const target = pendingScroll.current
    pendingScroll.current = null

    // Wait for tab content to render
    const timer = setTimeout(() => {
      const headings = document.querySelectorAll("h2, h3, h4")
      for (const el of headings) {
        if (el.textContent?.trim() === target) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          // Brief highlight
          el.classList.add("bg-blue-500/10", "rounded", "transition-colors")
          setTimeout(() => el.classList.remove("bg-blue-500/10", "rounded", "transition-colors"), 2000)
          break
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [activeTab])

  const selectResult = useCallback((entry: SearchEntry) => {
    setSearchQuery("")
    setShowResults(false)
    setSelectedIndex(0)
    pendingScroll.current = entry.section
    if (activeTab !== entry.tab) {
      setTab(entry.tab)
    } else {
      // Same tab — scroll immediately
      const headings = document.querySelectorAll("h2, h3, h4")
      for (const el of headings) {
        if (el.textContent?.trim() === entry.section) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          el.classList.add("bg-blue-500/10", "rounded", "transition-colors")
          setTimeout(() => el.classList.remove("bg-blue-500/10", "rounded", "transition-colors"), 2000)
          break
        }
      }
      pendingScroll.current = null
    }
  }, [activeTab])

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!showResults || searchResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      selectResult(searchResults[selectedIndex])
    } else if (e.key === "Escape") {
      setShowResults(false)
      inputRef.current?.blur()
    }
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

      {/* Search */}
      <div ref={searchRef} className="relative max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowResults(true)
              setSelectedIndex(0)
            }}
            onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search settings..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {showResults && searchQuery.length >= 2 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {searchResults.length > 0 ? (
              searchResults.map((entry, i) => {
                const tabLabel = TABS.find((t) => t.id === entry.tab)?.label || entry.tab
                return (
                  <button
                    key={`${entry.tab}-${entry.label}`}
                    onClick={() => selectResult(entry)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                      i === selectedIndex ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{tabLabel} &rsaquo; {entry.section}</span>
                  </button>
                )
              })
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No settings found for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
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
            <SectionHeading title="Payment Methods" />
            <PaymentMethodsSettings />
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

        {activeTab === "phone" && (
          <>
            <PhoneAssistantSettings />
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

        {activeTab === "decal-designer" && (
          <DecalDesignerSettings />
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
