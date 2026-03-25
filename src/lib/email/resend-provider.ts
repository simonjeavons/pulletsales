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
      const to = Array.isArray(message.to) ? message.to : [message.to];

      const { error } = await this.client.emails.send({
        from: this.from,
        to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content instanceof Buffer
            ? a.content
            : a.content instanceof Uint8Array
              ? Buffer.from(a.content)
              : Buffer.from(a.content, "base64"),
          content_type: a.contentType || "application/pdf",
        })),
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
