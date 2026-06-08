const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

async function sendEmail({ to, subject, html, text }) {
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "Room Management", email: process.env.EMAIL_USER },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Brevo API ${res.status}: ${errBody}`);
  }
}

module.exports = sendEmail;
