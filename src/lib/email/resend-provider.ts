import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./types";

export class ResendProvider implements EmailProvider {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (!this.client) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY is not set");
      }
      this.client = new Resend(apiKey);
    }
    return this.client;
  }

  private getFrom(): string {
    return process.env.EMAIL_FROM || "Country Fresh Pullets <noreply@lloydsanimalfeeds.com>";
  }

  async send(message: EmailMessage) {
    try {
      const to = Array.isArray(message.to) ? message.to : [message.to];

      const { error } = await this.getClient().emails.send({
        from: this.getFrom(),
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
