import { sendEmail } from "~/lib/email";

export async function sendDocumentEmail(params: {
  to: string[];
  subject: string;
  body: string;
  attachments: Array<{ filename: string; base64: string }>;
}) {
  if (!params.to.length) throw new Error("At least one recipient is required");
  if (!params.subject) throw new Error("Subject is required");
  if (!params.attachments.length) throw new Error("At least one attachment is required");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of params.to) {
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  const result = await sendEmail({
    to: params.to,
    subject: params.subject,
    html: params.body,
    text: params.body.replace(/<[^>]*>/g, ""),
    attachments: params.attachments.map((a) => ({
      filename: a.filename,
      content: a.base64,
      contentType: "application/pdf",
    })),
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send email");
  }

  return { success: true };
}
