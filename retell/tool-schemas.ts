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
      sms_consent: {
        type: 'boolean',
        description: 'true if the customer agreed to receive a confirmation text, false if they declined',
      },
    },
    required: [
      'caller_name',
      'caller_phone',
      'requested_date',
      'requested_time',
      'is_waiter',
      'sms_consent',
    ],
  },
}

export const FIND_CUSTOMER_APPOINTMENTS_TOOL = {
  type: 'custom' as const,
  name: 'find_customer_appointments',
  description:
    'Look up upcoming appointments for a customer by phone number. Use this when a customer wants to reschedule or cancel — it returns their upcoming appointments so you can confirm which one they mean.',
  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'}/api/retell/appointment/find`,
  speak_during_execution: true,
  speak_after_execution: true,
  execution_message_description:
    'Let me pull up your appointments — one moment.',
  parameters: {
    type: 'object',
    properties: {
      customer_phone: {
        type: 'string',
        description: 'Customer phone number (10 digits or E.164)',
      },
    },
    required: ['customer_phone'],
  },
}

export const MODIFY_APPOINTMENT_TOOL = {
  type: 'custom' as const,
  name: 'modify_appointment',
  description:
    'Reschedule an existing appointment to a new date and time. Use after confirming which appointment the customer wants to change via find_customer_appointments.',
  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'}/api/retell/appointment/modify`,
  speak_during_execution: true,
  speak_after_execution: true,
  execution_message_description:
    'Updating your appointment now — one moment.',
  parameters: {
    type: 'object',
    properties: {
      appointment_id: {
        type: 'number',
        description: 'The appointment ID to modify (from find_customer_appointments)',
      },
      new_date: {
        type: 'string',
        description: 'New date in YYYY-MM-DD format',
      },
      new_time: {
        type: 'string',
        description: 'New time in HH:MM 24-hour format',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for rescheduling',
      },
    },
    required: ['appointment_id', 'new_date', 'new_time'],
  },
}

export const CANCEL_APPOINTMENT_TOOL = {
  type: 'custom' as const,
  name: 'cancel_appointment',
  description:
    'Cancel an existing appointment. Use after confirming which appointment the customer wants to cancel via find_customer_appointments.',
  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'}/api/retell/appointment/cancel`,
  speak_during_execution: true,
  speak_after_execution: true,
  execution_message_description:
    'Cancelling your appointment now — one moment.',
  parameters: {
    type: 'object',
    properties: {
      appointment_id: {
        type: 'number',
        description: 'The appointment ID to cancel (from find_customer_appointments)',
      },
      reason: {
        type: 'string',
        description: 'Optional reason for cancellation',
      },
    },
    required: ['appointment_id'],
  },
}

export const CHECK_AVAILABILITY_TOOL = {
  type: 'custom' as const,
  name: 'check_availability',
  description:
    'Check if a specific date and time slot is available for booking. Returns availability status and up to 3 alternative slots if the requested time is taken. Use before modifying an appointment to confirm the new time works.',
  url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'}/api/retell/appointment/availability`,
  speak_during_execution: true,
  speak_after_execution: true,
  execution_message_description:
    'Checking availability — one moment.',
  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        description: 'Date to check in YYYY-MM-DD format',
      },
      time: {
        type: 'string',
        description: 'Time to check in HH:MM 24-hour format',
      },
    },
    required: ['date', 'time'],
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
