"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Check, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { StepShopIdentity } from "./steps/step-shop-identity"
import { StepRoNumbering } from "./steps/step-ro-numbering"
import { StepLaborRates } from "./steps/step-labor-rates"
import { StepCannedJobs } from "./steps/step-canned-jobs"
import { StepBusinessDefaults } from "./steps/step-business-defaults"
import { StepBranding } from "./steps/step-branding"
import { StepPhoneLine } from "./steps/step-phone-line"

const STEPS = [
  { id: 1, name: "shop_identity", label: "Shop Identity", required: true },
  { id: 2, name: "ro_numbering", label: "RO Numbering", required: true },
  { id: 3, name: "labor_rates", label: "Labor Rates", required: false },
  { id: 4, name: "canned_jobs", label: "Canned Jobs", required: false },
  { id: 5, name: "business_defaults", label: "Business Defaults", required: false },
  { id: 6, name: "branding", label: "Branding", required: false },
  { id: 7, name: "phone_line", label: "Phone Line", required: false },
] as const

interface SetupWizardProps {
  initialStep: number
  skippedSteps: string[]
}

export function SetupWizard({ initialStep, skippedSteps }: SetupWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(Math.max(initialStep, 0))
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    () => new Set(Array.from({ length: initialStep }, (_, i) => i))
  )
  const [skipped, setSkipped] = useState<Set<string>>(new Set(skippedSteps))
  const [saving, setSaving] = useState(false)

  const saveProgress = useCallback(async (step: number, stepSkipped?: string[]) => {
    try {
      const skippedArray = stepSkipped || Array.from(skipped)
      await fetch('/api/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_step_completed: step,
          setup_steps_skipped: skippedArray,
        }),
      })
    } catch {
      // Non-critical — progress save failure shouldn't block the user
    }
  }, [skipped])

  const handleNext = useCallback(async () => {
    const newCompleted = new Set(completedSteps)
    newCompleted.add(currentStep)
    setCompletedSteps(newCompleted)

    const nextStep = currentStep + 1
    await saveProgress(nextStep)

    if (nextStep >= STEPS.length) {
      await finishSetup()
    } else {
      setCurrentStep(nextStep)
    }
  }, [currentStep, completedSteps, saveProgress])

  const handleSkip = useCallback(async () => {
    const stepName = STEPS[currentStep].name
    const newSkipped = new Set(skipped)
    newSkipped.add(stepName)
    setSkipped(newSkipped)

    const newCompleted = new Set(completedSteps)
    newCompleted.add(currentStep)
    setCompletedSteps(newCompleted)

    const nextStep = currentStep + 1
    const skippedArray = Array.from(newSkipped)
    await saveProgress(nextStep, skippedArray)

    if (nextStep >= STEPS.length) {
      await finishSetup(skippedArray)
    } else {
      setCurrentStep(nextStep)
    }
  }, [currentStep, skipped, completedSteps, saveProgress])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  async function finishSetup(finalSkipped?: string[]) {
    setSaving(true)
    try {
      await fetch('/api/setup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_complete: true,
          setup_step_completed: STEPS.length,
          setup_steps_skipped: finalSkipped || Array.from(skipped),
        }),
      })
      toast.success('Setup complete! Welcome to RO Engine.')
      router.push('/')
    } catch {
      toast.error('Failed to save setup status')
    } finally {
      setSaving(false)
    }
  }

  const step = STEPS[currentStep]
  const canSkip = !step.required

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Wrench size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">RO Engine Setup</h1>
              <p className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i <= Math.max(...Array.from(completedSteps), currentStep) ? setCurrentStep(i) : null}
                disabled={i > Math.max(...Array.from(completedSteps), currentStep, 0)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  i === currentStep && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                  i < currentStep && completedSteps.has(i) && "bg-green-500/10 text-green-600",
                  i > currentStep && "text-muted-foreground",
                  i <= Math.max(...Array.from(completedSteps), currentStep, 0) ? "cursor-pointer hover:bg-muted/50" : "cursor-default opacity-50"
                )}
              >
                {completedSteps.has(i) && i !== currentStep ? (
                  <Check size={14} className="text-green-500 shrink-0" />
                ) : (
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    i === currentStep ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                )}
                <span className="hidden sm:inline truncate">{s.label}</span>
                {skipped.has(s.name) && (
                  <span className="text-[10px] text-orange-400 ml-auto hidden sm:inline">skipped</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-8 w-full">
        {currentStep === 0 && (
          <StepShopIdentity onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 1 && (
          <StepRoNumbering onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 2 && (
          <StepLaborRates onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />
        )}
        {currentStep === 3 && (
          <StepCannedJobs
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            laborRatesSkipped={skipped.has('labor_rates')}
          />
        )}
        {currentStep === 4 && (
          <StepBusinessDefaults onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />
        )}
        {currentStep === 5 && (
          <StepBranding
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
            saving={saving}
          />
        )}
        {currentStep === 6 && (
          <StepPhoneLine
            onNext={() => finishSetup()}
            onBack={handleBack}
            onSkip={() => finishSetup(Array.from(new Set([...skipped, 'phone_line'])))}
          />
        )}
      </div>
    </div>
  )
}
