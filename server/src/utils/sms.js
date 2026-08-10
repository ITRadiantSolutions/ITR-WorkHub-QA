import twilio from "twilio";

let client;
const getClient = () => {
  if (client !== undefined) return client;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  client = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
  return client;
};

// Accepts a 10-digit Indian mobile number or one already in E.164 form.
const formatPhoneNumber = (phoneNumber) => {
  const digits = String(phoneNumber || "").replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  throw new Error(`Invalid phone number: ${phoneNumber}`);
};

export async function sendSms(mobileNumber, body) {
  const twilioClient = getClient();
  if (!twilioClient) throw new Error("Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)");

  const to = formatPhoneNumber(mobileNumber);
  const { TWILIO_MESSAGING_SERVICE_SID, TWILIO_PHONE_NUMBER } = process.env;

  return TWILIO_MESSAGING_SERVICE_SID
    ? twilioClient.messages.create({ messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID, to, body })
    : twilioClient.messages.create({ from: TWILIO_PHONE_NUMBER, to, body });
}
