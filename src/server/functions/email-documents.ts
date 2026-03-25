import { createServerFn } from "@tanstack/react-start";
import { sendEmail } from "~/lib/email";

/**
 * Send document PDFs via email.
 * PDFs are generated client-side, base64-encoded, and sent here for emailing.
 */
export const sendDocumentEmailFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      to: string[];
      subject: string;
      body: string;
      attachments: Array<{
        filename: string;
        base64: string;
      }>;
    }) => data
  )
  .handler(async ({ data }) => {
    if (!data.to.length) throw new Error("At least one recipient is required");
    if (!data.subject) throw new Error("Subject is required");
    if (!data.attachments.length) throw new Error("At least one attachment is required");

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of data.to) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    const result = await sendEmail({
      to: data.to,
      subject: data.subject,
      html: data.body,
      text: data.body.replace(/<[^>]*>/g, ""),
      attachments: data.attachments.map((a) => ({
        filename: a.filename,
        content: a.base64,
        contentType: "application/pdf",
      })),
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    return { success: true };
  });
