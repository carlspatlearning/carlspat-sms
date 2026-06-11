import { env } from "../config/env";

/**
 * Email (SendGrid) and SMS (Twilio) delivery via their REST APIs.
 * When credentials are not configured the message is logged instead, so the
 * system remains fully functional in development.
 */

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!env.sendgrid.apiKey) {
    console.log(`[email:dev] to=${to} subject="${subject}"`);
    return false;
  }
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.sendgrid.from, name: "Carlspat Private School" },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!res.ok) {
    console.error("SendGrid error:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!env.twilio.sid || !env.twilio.token || !env.twilio.from) {
    console.log(`[sms:dev] to=${to} body="${body}"`);
    return false;
  }
  const auth = Buffer.from(`${env.twilio.sid}:${env.twilio.token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.twilio.sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: env.twilio.from, Body: body }),
    }
  );
  if (!res.ok) {
    console.error("Twilio error:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}
