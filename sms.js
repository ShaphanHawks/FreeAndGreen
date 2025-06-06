// SMS helper module using Twilio
const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;

// Check if Twilio credentials are configured
if (accountSid && authToken && twilioPhoneNumber) {
    client = twilio(accountSid, authToken);
    console.log('Twilio SMS service initialized');
} else {
    console.warn('Twilio credentials not configured - SMS functionality will be disabled');
}

/**
 * Send SMS message using Twilio
 * @param {string} to - Phone number to send to (format: +1234567890)
 * @param {string} message - Message content
 * @returns {Promise} - Resolves with message SID or rejects with error
 */
const sendSms = async (to, message) => {
    if (!client) {
        console.warn('SMS not sent - Twilio not configured');
        return Promise.resolve({ status: 'disabled', message: 'SMS service not configured' });
    }

    try {
        // Clean phone number - extract digits only and add +1 prefix if needed
        let cleanNumber = to.replace(/\D/g, '');
        if (cleanNumber.length === 10) {
            cleanNumber = '+1' + cleanNumber;
        } else if (cleanNumber.length === 11 && cleanNumber.startsWith('1')) {
            cleanNumber = '+' + cleanNumber;
        } else {
            cleanNumber = '+' + cleanNumber;
        }

        const messageResponse = await client.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: cleanNumber
        });

        console.log(`SMS sent successfully: ${messageResponse.sid}`);
        return {
            status: 'sent',
            sid: messageResponse.sid,
            to: cleanNumber
        };
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};

/**
 * Extract phone number from address (basic implementation)
 * In a real application, you would need to collect phone numbers separately
 * @param {string} address - Address string
 * @returns {string|null} - Extracted phone number or null
 */
const extractPhoneFromAddress = (address) => {
    // Basic regex to find phone numbers in address
    const phoneRegex = /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const match = address.match(phoneRegex);
    
    if (match) {
        return match[0];
    }
    
    // For demo purposes, return a placeholder
    // In production, you would collect phone numbers in the form
    return '+15551234567'; // Demo phone number
};

module.exports = {
    sendSms,
    extractPhoneFromAddress
};
