"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { CheckIcon as Check, MoonIcon as Moon, SunIcon as Sun, ComputerDesktopIcon as Monitor } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"

type ColorTheme = "default" | "ocean" | "forest" | "sunset" | "ruby" | "violet"

interface ThemeOption {
  id: ColorTheme
  name: string
  description: string
  colors: {
    primary: string
    accent: string
    muted: string
  }
}

const themes: ThemeOption[] = [
  {
    id: "default",
    name: "Neutral",
    description: "Clean grayscale theme",
    colors: {
      primary: "bg-neutral-900 dark:bg-neutral-100",
      accent: "bg-neutral-600",
      muted: "bg-neutral-200",
    },
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Professional blue tones",
    colors: {
      primary: "bg-blue-600",
      accent: "bg-blue-400",
      muted: "bg-blue-100",
    },
  },
  {
    id: "forest",
    name: "Forest Green",
    description: "Natural green palette",
    colors: {
      primary: "bg-green-700",
      accent: "bg-green-500",
      muted: "bg-green-100",
    },
  },
  {
    id: "sunset",
    name: "Sunset Orange",
    description: "Warm orange accents",
    colors: {
      primary: "bg-orange-500",
      accent: "bg-orange-400",
      muted: "bg-orange-100",
    },
  },
  {
    id: "ruby",
    name: "Ruby Red",
    description: "Bold red highlights",
    colors: {
      primary: "bg-red-600",
      accent: "bg-red-400",
      muted: "bg-red-100",
    },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Modern purple tones",
    colors: {
      primary: "bg-violet-600",
      accent: "bg-violet-400",
      muted: "bg-violet-100",
    },
  },
]

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [colorTheme, setColorTheme] = useState<ColorTheme>("default")
  const [reducedMotion, setReducedMotion] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load saved color theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("ro-color-theme") as ColorTheme | null
    const savedReducedMotion = localStorage.getItem("ro-reduced-motion")
    const savedCompactMode = localStorage.getItem("ro-compact-mode")

    if (savedTheme) setColorTheme(savedTheme)
    if (savedReducedMotion) setReducedMotion(savedReducedMotion === "true")
    if (savedCompactMode) setCompactMode(savedCompactMode === "true")
  }, [])

  // Apply color theme changes
  useEffect(() => {
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove("theme-ocean", "theme-forest", "theme-sunset", "theme-ruby", "theme-violet")

    // Add new theme class if not default
    if (colorTheme !== "default") {
      root.classList.add(`theme-${colorTheme}`)
    }

    // Save preference
    localStorage.setItem("ro-color-theme", colorTheme)
  }, [colorTheme])

  // Save other preferences
  useEffect(() => {
    localStorage.setItem("ro-reduced-motion", String(reducedMotion))
  }, [reducedMotion])

  useEffect(() => {
    localStorage.setItem("ro-compact-mode", String(compactMode))
  }, [compactMode])

  // Avoid hydration mismatch
  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Color Theme Selection */}
      <Card className="p-6 border-border">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Color Theme</h3>
          <p className="text-sm text-muted-foreground">
            Choose a color theme that works best for you
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setColorTheme(theme.id)}
              className={cn(
                "relative p-4 rounded-lg border-2 transition-all text-left",
                colorTheme === theme.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              {colorTheme === theme.id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check size={12} className="text-primary-foreground" />
                </div>
              )}
              
              {/* Color Preview */}
              <div className="flex gap-1.5 mb-3">
                <div className={cn("w-8 h-8 rounded-md", theme.colors.primary)} />
                <div className={cn("w-8 h-8 rounded-md", theme.colors.accent)} />
                <div className={cn("w-8 h-8 rounded-md", theme.colors.muted)} />
              </div>
              
              <p className="font-medium text-foreground">{theme.name}</p>
              <p className="text-xs text-muted-foreground">{theme.description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Light/Dark Mode */}
      <Card className="p-6 border-border">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Appearance Mode</h3>
          <p className="text-sm text-muted-foreground">
            Select light, dark, or sync with your system
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            className="flex-1 h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setTheme("light")}
          >
            <Sun size={20} />
            <span>Light</span>
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            className="flex-1 h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setTheme("dark")}
          >
            <Moon size={20} />
            <span>Dark</span>
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            className="flex-1 h-auto py-4 flex flex-col items-center gap-2"
            onClick={() => setTheme("system")}
          >
            <Monitor size={20} />
            <span>System</span>
          </Button>
        </div>
      </Card>

      {/* Accessibility Options */}
      <Card className="p-6 border-border">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Accessibility</h3>
          <p className="text-sm text-muted-foreground">
            Customize your viewing experience
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium text-foreground">Reduced Motion</Label>
              <p className="text-sm text-muted-foreground">
                Minimize animations throughout the interface
              </p>
            </div>
            <Switch
              checked={reducedMotion}
              onCheckedChange={setReducedMotion}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium text-foreground">Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing to show more content
              </p>
            </div>
            <Switch
              checked={compactMode}
              onCheckedChange={setCompactMode}
            />
          </div>
        </div>
      </Card>

      {/* Preview Card */}
      <Card className="p-6 border-border">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Preview</h3>
          <p className="text-sm text-muted-foreground">
            See how your selections look in context
          </p>
        </div>

        <div className="p-6 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">RO</span>
            </div>
            <div>
              <p className="font-semibold text-card-foreground">Sample Repair Order</p>
              <p className="text-sm text-muted-foreground">2024 Toyota Camry - Oil Change</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm">Approve</Button>
            <Button size="sm" variant="outline">View Details</Button>
            <Button size="sm" variant="secondary">Message</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
