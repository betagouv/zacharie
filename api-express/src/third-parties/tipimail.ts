interface SendEmailProps {
  emails?: string[];
  text: string;
  html: string;
  subject: string;
  from?: string;
}

export async function sendEmail({
  emails = ['arnaud@ambroselli.io'],
  text,
  html,
  subject,
  from = 'contact@zacharie.beta.gouv.fr',
}: SendEmailProps) {
  if (process.env.NODE_ENV !== 'production') {
    console.log({ emails, text, html, subject, from });
    return Promise.resolve({ status: 'success' });
  }

  return fetch('https://api.tipimail.com/v1/messages/send', {
    method: 'POST',
    headers: {
      'X-Tipimail-ApiUser': process.env.VITE_TIPIMAIL_API_USER!,
      'X-Tipimail-ApiKey': process.env.VITE_TIPIMAIL_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: process.env.VITE_TIPIMAIL_API_KEY!,
      to: emails.map((address) => ({ address })),
      msg: {
        from: {
          address: from,
          personalName: 'Zacharie',
        },
        subject,
        text,
        // html,
      },
      headers: {
        'X-TM-TRACKING': { html: { open: 0, click: 0, text: { click: 0 } } },
      },
    }),
  })
    .then((response) => response.json())
    .then(console.log)
    .catch((error) => {
      console.error('Error sending email', error);
    });
}
