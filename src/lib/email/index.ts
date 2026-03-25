import type { EmailProvider, EmailMessage, EmailAttachment } from "./types";
import { ResendProvider } from "./resend-provider";

// ─── Provider singleton ──────────────────────────────────
// Swap this line to change email provider across the entire app
let provider: EmailProvider | null = null;

function getProvider(): EmailProvider {
  if (!provider) {
    provider = new ResendProvider();
  }
  return provider;
}

// ─── Public API ──────────────────────────────────────────
export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}) {
  return getProvider().send(params);
}

export { type EmailProvider, type EmailMessage, type EmailAttachment } from "./types";
