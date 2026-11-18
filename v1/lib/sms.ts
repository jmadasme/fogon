import "server-only";

type SmsInput = {
  to: string;
  body: string;
};

export async function sendSms(input: SmsInput) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Twilio no está configurado para enviar SMS.");
    }
    console.info(`[sms:dev] to=${input.to} body=${input.body}`);
    return { dev: true as const };
  }

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`No pudimos enviar el SMS (${response.status}): ${detail}`);
  }
  return { dev: false as const };
}
