import {env} from "../config/env.js";
import {ApiError} from "../utils/api-error.js";

export async function sendMobileCode(phone: string, code: string) {
  const {TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_MESSAGING_SERVICE_SID: service} = env;
  const unavailable = () => new ApiError(503, "SMS_UNAVAILABLE", "Mobile verification is temporarily unavailable. Please try again or sign in with email.");
  if (!sid || !token || !service || !/^AC[a-f0-9]{32}$/i.test(sid)) throw unavailable();
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {"Authorization": "Basic " + Buffer.from(sid + ":" + token).toString("base64"), "Content-Type": "application/x-www-form-urlencoded"},
      body: new URLSearchParams({To: phone, MessagingServiceSid: service, Body: `Your The Property Pillar verification code is ${code}. It expires in 5 minutes.`}),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw unavailable();
  } catch {throw unavailable();}
}
