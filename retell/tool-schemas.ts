/**
 * Retell tool schemas — single source of truth.
 * Used by setup-agents.ts and sync-date route.
 */

export const BOOK_APPOINTMENT_TOOL = {
  type: 'custom' as const,
  name: 'book_appointment',
  description:
    'Book an appointment for the customer. Call this once you have all required info: name, phone, vehicle, date/time, waiter/dropoff, and reason. You MUST pass all collected details as arguments.',
  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'}/api/retell/appointment`,
  speak_during_execution: true,
  speak_after_execution: true,
  execution_message_description:
    'Booking your appointment now — one moment.',
  parameters: {
    type: 'object',
    properties: {
      caller_name: {
        type: 'string',
        description: 'Full name of the caller',
      },
      caller_phone: {
        type: 'string',
        description: 'Callback phone number (10 digits or E.164)',
      },
      vehicle_plate: {
        type: 'string',
        description: 'License plate number if provided',
      },
      vehicle_year: {
        type: 'string',
        description: 'Vehicle year (e.g. "2019")',
      },
      vehicle_make: {
        type: 'string',
        description: 'Vehicle make (e.g. "Volvo")',
      },
      vehicle_model: {
        type: 'string',
        description: 'Vehicle model (e.g. "XC90")',
      },
      mileage: {
        type: 'string',
        description: 'Current vehicle mileage if known',
      },
      is_waiter: {
        type: 'boolean',
        description: 'true if the customer will wait, false for drop-off',
      },
      requested_date: {
        type: 'string',
        description: 'Requested date in YYYY-MM-DD format',
      },
      requested_time: {
        type: 'string',
        description: 'Requested time in HH:MM 24-hour format',
      },
      call_reason: {
        type: 'string',
        description: 'Brief description of why the vehicle is coming in',
      },
    },
    required: [
      'caller_name',
      'caller_phone',
      'requested_date',
      'requested_time',
      'is_waiter',
    ],
  },
}

export const END_CALL_TOOL = {
  type: 'end_call' as const,
  name: 'end_call',
  description:
    'End the call after the appointment is confirmed and you have said goodbye.',
}

/**
 * Build the agent_swap tool definition for Agent 1 → Agent 2 handoff.
 * Returns null if RETELL_AGENT_ID_SCHEDULER is not configured.
 */
export function buildAgentSwapTool(schedulerAgentId: string | undefined) {
  if (!schedulerAgentId) return null

  return {
    type: 'agent_swap' as const,
    name: 'transfer_to_scheduler',
    description:
      'Transfer the caller to the scheduling agent once you have their name, callback number, and vehicle info (plate or year/make/model) confirmed.',
    agent_id: schedulerAgentId,
    keep_current_voice: true,
    webhook_setting: 'only_source_agent' as const,
    post_call_analysis_setting: 'both_agents' as const,
  }
}
