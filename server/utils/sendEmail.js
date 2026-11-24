const nodemailer = require("nodemailer");

let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;
  if (!host || !user || !password || host === "smtp.example.com" || user.includes("your_email")) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user, pass: password },
  });
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured. Set EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD.");
    }
    // Do not print message bodies or password-reset URLs to application logs.
    console.warn(`[sendEmail] SMTP is not configured; email to ${to} was not sent.`);
    return { simulated: true };
  }

  return mailer.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
