import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./types";

export class ResendProvider implements EmailProvider {
  async send(message: EmailMessage) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return { success: false, error: "RESEND_API_KEY is not configured" };
      }

      const client = new Resend(apiKey);
      const from = process.env.EMAIL_FROM || "Country Fresh Pullets <noreply@lloydsanimalfeeds.com>";
      const to = Array.isArray(message.to) ? message.to : [message.to];

      const { error } = await client.emails.send({
        from,
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
