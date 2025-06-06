// SMS integration module using Twilio
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWI_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWI_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWI_PHONE;

let client: twilio.Twilio | null = null;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.warn('Twilio credentials not found. SMS functionality will be disabled.');
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!client || !phoneNumber) {
    console.log('SMS would be sent:', { to, message });
    return false;
  }

  try {
    const response = await client.messages.create({
      body: message,
      from: phoneNumber,
      to: to
    });
    
    console.log('SMS sent successfully:', response.sid);
    return true;
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}
