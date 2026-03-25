import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { sendDocumentEmailFn } from "~/server/functions/email-documents";
import { Button } from "./Button";

export interface EmailRecipient {
  label: string;
  email: string;
}

export interface EmailAttachment {
  label: string;
  filename: string;
  /** async function that returns base64-encoded PDF */
  generateBase64: () => Promise<string>;
  selected?: boolean;
}

interface EmailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Pre-filled subject line */
  defaultSubject: string;
  /** Suggested recipients with checkboxes */
  recipients: EmailRecipient[];
  /** Documents that can be attached */
  attachments: EmailAttachment[];
  /** Default body text */
  defaultBody?: string;
}

export function EmailModal({
  open,
  onClose,
  title,
  defaultSubject,
  recipients,
  attachments,
  defaultBody,
}: EmailModalProps) {
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(
    recipients.map((r) => r.email)
  );
  const [additionalEmail, setAdditionalEmail] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>(
    attachments.filter((a) => a.selected !== false).map((a) => a.label)
  );
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(
    defaultBody || "Please find the attached document(s)."
  );
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const sendMut = useMutation({
    mutationFn: async () => {
      setError("");

      const allRecipients = [...selectedRecipients];
      if (additionalEmail.trim()) {
        allRecipients.push(additionalEmail.trim());
      }

      if (allRecipients.length === 0) {
        throw new Error("Select at least one recipient");
      }

      if (selectedAttachments.length === 0) {
        throw new Error("Select at least one document to attach");
      }

      // Generate PDFs for selected attachments
      const pdfAttachments: Array<{ filename: string; base64: string }> = [];
      for (const label of selectedAttachments) {
        const att = attachments.find((a) => a.label === label);
        if (att) {
          const base64 = await att.generateBase64();
          pdfAttachments.push({ filename: att.filename, base64 });
        }
      }

      return sendDocumentEmailFn({
        data: {
          to: allRecipients,
          subject,
          body: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
          attachments: pdfAttachments,
        },
      });
    },
    onSuccess: () => setSent(true),
    onError: (err: any) => setError(err.message),
  });

  if (!open) return null;

  const toggleRecipient = (email: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const toggleAttachment = (label: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div className="text-green-500 mb-2">
                <svg
                  className="w-12 h-12 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                Email Sent
              </p>
              <p className="text-sm text-gray-500">
                Document(s) sent successfully.
              </p>
              <Button onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send To
                </label>
                <div className="space-y-2">
                  {recipients.map((r) => (
                    <label
                      key={r.email}
                      className="flex items-center gap-3 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRecipients.includes(r.email)}
                        onChange={() => toggleRecipient(r.email)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-gray-600">{r.label}:</span>
                      <span className="font-medium">{r.email}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="email"
                    value={additionalEmail}
                    onChange={(e) => setAdditionalEmail(e.target.value)}
                    placeholder="Additional email address..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Attachments */}
              {attachments.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attach Documents
                  </label>
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <label
                        key={a.label}
                        className="flex items-center gap-3 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAttachments.includes(a.label)}
                          onChange={() => toggleAttachment(a.label)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </>
          )}
        </div>

        {!sent && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => sendMut.mutate()}
              loading={sendMut.isPending}
            >
              Send Email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
