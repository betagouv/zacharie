interface SendEmailProps {
  emails?: string[];
  text: string;
  html: string;
  subject: string;
  from?: string;
}

export function sendEmail({
  emails = ["arnaud@ambroselli.io"],
  text,
  html,
  subject,
  from = "contact@zacharie.beta.gouv.fr",
}: SendEmailProps) {
  if (!process.env.TIPIMAIL_API_USER || !process.env.TIPIMAIL_API_KEY) {
    console.error("TIPIMAIL_API_USER or TIPIMAIL_API_KEY not set");
    return;
  }
  return fetch("https://api.tipimail.com/v1/messages/send", {
    method: "POST",
    headers: {
      "X-Tipimail-ApiUser": process.env.TIPIMAIL_API_USER,
      "X-Tipimail-ApiKey": process.env.TIPIMAIL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: process.env.TIPIMAIL_API_KEY,
      to: emails.map((address) => ({ address })),
      msg: {
        from: {
          address: from,
          personalName: "Zacharie",
        },
        subject,
        text,
        html,
      },
      headers: { "X-TM-TRACKING": { html: { open: 0, click: 0, text: { click: 0 } } } },
    }),
  });
}