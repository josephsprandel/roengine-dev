"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useLoadScript, Autocomplete } from "@react-google-maps/api"
import { formatPhoneNumber, unformatPhoneNumber } from "@/lib/utils/phone-format"

const libraries: ("places")[] = ["places"]

interface Customer {
  id: string
  customer_name: string
  first_name: string | null
  last_name: string | null
  phone_primary: string
  phone_secondary: string | null
  phone_mobile: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  customer_type: string
  notes: string | null
}

interface CustomerCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  customer?: Customer  // If provided, dialog is in edit mode
}

export function CustomerCreateDialog({ open, onOpenChange, onSuccess, customer }: CustomerCreateDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const { isLoaded, loadError} = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  })

  const isEditMode = !!customer

  // Initialize form data based on mode (create or edit)
  const getInitialFormData = () => {
    if (customer) {
      return {
        customer_name: customer.customer_name || "",
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        phone_primary: formatPhoneNumber(customer.phone_primary || ""),
        phone_secondary: formatPhoneNumber(customer.phone_secondary || ""),
        phone_mobile: formatPhoneNumber(customer.phone_mobile || ""),
        email: customer.email || "",
        address_line1: customer.address_line1 || "",
        address_line2: customer.address_line2 || "",
        city: customer.city || "",
        state: customer.state || "",
        zip: customer.zip || "",
        customer_type: customer.customer_type || "individual",
        notes: customer.notes || "",
      }
    }
    return {
      customer_name: "",
      first_name: "",
      last_name: "",
      phone_primary: "",
      phone_secondary: "",
      phone_mobile: "",
      email: "",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip: "",
      customer_type: "individual",
      notes: "",
    }
  }

  const [formData, setFormData] = useState(getInitialFormData())

  // Update form data when customer prop changes
  useEffect(() => {
    setFormData(getInitialFormData())
  }, [customer])

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()

      if (place.address_components) {
        let street = ""
        let city = ""
        let state = ""
        let zip = ""

        place.address_components.forEach((component) => {
          const types = component.types

          if (types.includes("street_number")) {
            street = component.long_name + " "
          }
          if (types.includes("route")) {
            street += component.long_name
          }
          if (types.includes("locality")) {
            city = component.long_name
          }
          if (types.includes("administrative_area_level_1")) {
            state = component.short_name
          }
          if (types.includes("postal_code")) {
            zip = component.long_name
          }
        })

        setFormData((prev) => ({
          ...prev,
          address_line1: street.trim(),
          city,
          state,
          zip,
        }))
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = isEditMode ? `/api/customers/${customer.id}` : "/api/customers"
      const method = isEditMode ? "PATCH" : "POST"

      // Unformat phone numbers before sending to API
      const submissionData = {
        ...formData,
        phone_primary: unformatPhoneNumber(formData.phone_primary),
        phone_secondary: unformatPhoneNumber(formData.phone_secondary),
        phone_mobile: unformatPhoneNumber(formData.phone_mobile),
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} customer`)
      }

      // Success!
      onSuccess()
      onOpenChange(false)

      // Reset form only if in create mode
      if (!isEditMode) {
        setFormData({
          customer_name: "",
          first_name: "",
          last_name: "",
          phone_primary: "",
          phone_secondary: "",
          phone_mobile: "",
          email: "",
          address_line1: "",
          address_line2: "",
          city: "",
          state: "",
          zip: "",
          customer_type: "individual",
          notes: "",
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Customer' : 'Create New Customer'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Full name or business name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="customer_type">Customer Type</Label>
                <Select
                  value={formData.customer_type}
                  onValueChange={(value) => setFormData({ ...formData, customer_type: value })}
                >
                  <SelectTrigger id="customer_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Contact Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone_primary">Primary Phone *</Label>
                <Input
                  id="phone_primary"
                  type="tel"
                  value={formData.phone_primary}
                  onChange={(e) => setFormData({ ...formData, phone_primary: formatPhoneNumber(e.target.value) })}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone_secondary">Secondary Phone</Label>
                <Input
                  id="phone_secondary"
                  type="tel"
                  value={formData.phone_secondary}
                  onChange={(e) => setFormData({ ...formData, phone_secondary: formatPhoneNumber(e.target.value) })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="phone_mobile">Mobile Phone</Label>
                <Input
                  id="phone_mobile"
                  type="tel"
                  value={formData.phone_mobile}
                  onChange={(e) => setFormData({ ...formData, phone_mobile: formatPhoneNumber(e.target.value) })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">Address</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="address_line1">Address Line 1</Label>
                {loadError && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    Google Maps Error: {loadError.message}
                    <br/>Check browser console for details.
                  </div>
                )}
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onAutocompleteLoad}
                    onPlaceChanged={onPlaceChanged}
                    options={{
                      componentRestrictions: { country: "us" },
                      fields: ["address_components"],
                      types: ["address"],
                    }}
                  >
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      placeholder="Street address"
                    />
                  </Autocomplete>
                ) : (
                  <>
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      placeholder={loadError ? "Street address (autocomplete unavailable)" : "Street address (loading...)"}
                    />
                    {!loadError && (
                      <p className="text-xs text-muted-foreground mt-1">Loading Google Maps autocomplete...</p>
                    )}
                  </>
                )}
              </div>

              <div>
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  placeholder="Apt, suite, etc."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    maxLength={2}
                    placeholder="AR"
                  />
                </div>
              </div>

              <div className="w-1/3">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  placeholder="72701"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional customer information..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
