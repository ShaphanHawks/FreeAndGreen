// Client-side SMS utility (mainly for type definitions and constants)
// Actual SMS sending is handled server-side via the API

export interface SmsTemplate {
  type: 'Scheduled' | 'Completed';
  text: string;
}

export const SMS_TEMPLATES = {
  Scheduled: "We will be there on [scheduled_date] between [timeslot] to pick up your appliance.",
  Completed: "Your pickup at [address] has been completed. Thank you!"
} as const;

export function formatSmsMessage(template: string, variables: Record<string, string>): string {
  let message = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  });
  
  return message;
}

// Phone number validation utility
export function isValidPhoneNumber(phone: string): boolean {
  // Basic phone number validation (US format)
  const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Format phone number for display
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default {
  SMS_TEMPLATES,
  formatSmsMessage,
  isValidPhoneNumber,
  formatPhoneNumber,
};
