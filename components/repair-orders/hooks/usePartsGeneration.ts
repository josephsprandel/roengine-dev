"use client"

import { useState, useCallback } from "react"

interface UsePartsGenerationReturn {
  // State
  servicesWithParts: any[]
  generating: boolean
  loadingStep: string

  // Dialog state
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void

  // Actions
  generateParts: () => Promise<void>
  confirmPartsSelection: (servicesWithSelectedParts: any[]) => Promise<void>
}

interface PartsGenerationVehicle {
  year: number
  make: string
  model: string
  vin: string
  vehicle_id: number
}

/**
 * Hook: usePartsGeneration
 *
 * Handles the AI parts generation workflow for maintenance recommendations.
 *
 * WORKFLOW:
 * 1. Generate parts list with AI + pricing lookup
 * 2. Show parts selection modal
 * 3. Save to vehicle_recommendations table (NOT directly to RO)
 * 4. Service advisor later approves recommendations to add to RO
 *
 * @param selectedAiServices - Currently selected AI services (from useAIRecommendations)
 * @param vehicle - Vehicle info for parts generation API
 * @param onSaveComplete - Callback after recommendations are saved
 * @param showToast - Callback to show toast notifications
 */
export function usePartsGeneration(
  selectedAiServices: any[],
  vehicle: PartsGenerationVehicle | null,
  onSaveComplete: () => void,
  showToast: (message: string, type: "success" | "error") => void
): UsePartsGenerationReturn {
  // Parts generation states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [servicesWithParts, setServicesWithParts] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>('')

  /**
   * Generate parts list with AI + PartsTech pricing
   */
  const generateParts = useCallback(async () => {
    if (selectedAiServices.length === 0) return

    console.log('=== GENERATING PARTS LIST FOR RECOMMENDATIONS ===')
    console.log('Selected services:', selectedAiServices.length)

    setGenerating(true)

    try {
      // Step 1: Analyzing services
      setLoadingStep('Analyzing services...')
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 2: Generating parts list with AI
      setLoadingStep('Generating parts list with AI...')
      const partsResponse = await fetch('/api/services/generate-parts-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedAiServices.map(s => ({
            service_name: s.service_name,
            service_description: s.service_description
          })),
          vehicle: vehicle ? {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            engine: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            vin: vehicle.vin
          } : undefined
        })
      })

      if (!partsResponse.ok) {
        const errorText = await partsResponse.text()
        console.error('Parts API Error:', errorText)
        throw new Error(`Failed to generate parts list: ${errorText}`)
      }

      // Step 3: Looking up pricing
      setLoadingStep('Looking up pricing...')
      const { servicesWithParts: generatedParts } = await partsResponse.json()
      console.log('✓ Parts generated for', generatedParts.length, 'services')

      // Step 4: Preparing selection
      setLoadingStep('Preparing selection...')
      await new Promise(resolve => setTimeout(resolve, 200))

      // Done - Show parts selection modal
      setServicesWithParts(generatedParts)
      setDialogOpen(true)

    } catch (error: any) {
      console.error('Failed to generate parts:', error)
      showToast(error.message || 'Failed to generate parts list', 'error')
    } finally {
      setGenerating(false)
      setLoadingStep('')
    }
  }, [selectedAiServices, vehicle, showToast])

  /**
   * Confirm parts selection and save to recommendations table
   *
   * This saves recommendations to vehicle_recommendations table with status='awaiting_approval'
   * so service advisors can review and approve them later.
   */
  const confirmPartsSelection = useCallback(async (servicesWithSelectedParts: any[]) => {
    if (!vehicle?.vehicle_id) {
      showToast('Vehicle ID not found', 'error')
      return
    }

    console.log('=== SAVING RECOMMENDATIONS WITH PARTS ===')
    setDialogOpen(false)

    try {
      // Build recommendations payload in the format expected by /api/save-recommendations
      const recommendations = servicesWithSelectedParts.map((serviceData, i) => {
        const aiService = selectedAiServices[i]

        // Build parts array from selected options (API expects 'parts', not 'parts_items')
        const parts = serviceData.parts
          .filter((part: any) => part.selectedOption) // Only include parts with pricing
          .map((part: any) => ({
            part_number: part.selectedOption.partNumber || '',
            description: part.selectedOption.description || part.description,
            qty: part.quantity,
            unit: part.unit || 'each',
            price: part.selectedOption.retailPrice || 0,
            total: (part.selectedOption.retailPrice || 0) * part.quantity
          }))

        return {
          service_name: serviceData.serviceName,
          service_description: aiService.service_description || '',
          service_category: aiService.service_category || 'maintenance',
          urgency: aiService.urgency || 'DUE_NOW',
          reason: aiService.service_description || `Due at ${aiService.mileage_interval?.toLocaleString() || 'N/A'} miles`,
          mileage_interval: aiService.mileage_interval,
          estimated_labor_hours: aiService.estimated_labor_hours || 1,
          driving_condition: aiService.driving_condition,
          parts: parts  // API expects 'parts', not 'parts_items'
        }
      })

      // Save to database
      console.log('Saving', recommendations.length, 'recommendations to database...')

      const saveResponse = await fetch('/api/save-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicle.vehicle_id,
          services: recommendations
        })
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        console.error('Save error:', errorText)
        throw new Error(`Failed to save: ${saveResponse.status}`)
      }

      const saveData = await saveResponse.json()
      console.log('✓ Save successful:', saveData)
      console.log('✓ Saved recommendation IDs:', saveData.recommendation_ids)

      showToast('Recommendations saved successfully', 'success')
      onSaveComplete()

    } catch (error: any) {
      console.error('Failed to save recommendations:', error)
      showToast(error.message || 'Failed to save recommendations', 'error')
    }

    console.log('=== SAVE COMPLETE ===')
  }, [vehicle, selectedAiServices, showToast, onSaveComplete])

  return {
    // State
    servicesWithParts,
    generating,
    loadingStep,

    // Dialog state
    dialogOpen,
    setDialogOpen,

    // Actions
    generateParts,
    confirmPartsSelection,
  }
}
