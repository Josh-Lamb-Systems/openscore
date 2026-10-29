import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env.server";

interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transport: Transporter | undefined;

/**
 * Sends an auth-related email (invites, password reset, magic links).
 * Without SMTP_HOST configured, the email is printed to the server log instead.
 */
export async function sendEmail(email: Email): Promise<void> {
  const e = env();
  if (!e.SMTP_HOST) {
    console.info(
      `\n[email] SMTP not configured; printing instead.\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`,
    );
    return;
  }
  transport ??= nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: e.SMTP_FROM, ...email });
}
