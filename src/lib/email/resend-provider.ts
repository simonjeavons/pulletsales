import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./types";

export class ResendProvider implements EmailProvider {
  private client: Resend;
  private from: string;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.EMAIL_FROM || "noreply@pulletsales.com";
  }

  async send(message: EmailMessage) {
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown email error";
      return { success: false, error: errorMessage };
    }
  }
}
