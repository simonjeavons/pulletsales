import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listEmailTemplatesFn,
  updateEmailTemplateFn,
} from "~/server/functions/email-templates";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { FormField, inputClasses, textareaClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/_authenticated/admin/email-templates")({
  component: EmailTemplatesPage,
});

const PLACEHOLDERS = [
  { key: "{{order_number}}", desc: "Order number" },
  { key: "{{invoice_number}}", desc: "Invoice number" },
  { key: "{{customer_name}}", desc: "Customer name" },
  { key: "{{rep_name}}", desc: "Rep name" },
  { key: "{{delivery_date}}", desc: "Delivery date" },
  { key: "{{name}}", desc: "Recipient name" },
  { key: "{{action_url}}", desc: "Action link URL" },
];

function EmailTemplatesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => listEmailTemplatesFn(),
  });

  const updateMut = useMutation({
    mutationFn: updateEmailTemplateFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-templates"] });
      setEditing(null);
    },
  });

  const startEdit = (t: any) => {
    setEditing(t);
    setEditSubject(t.subject);
    setEditBody(t.body);
  };

  // Sort templates alphabetically by label
  const sorted = [...templates].sort((a: any, b: any) =>
    (a.label || "").localeCompare(b.label || "")
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Email Templates"
        description="Click a template to edit its subject and body text."
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Template</th>
              <th className="px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Subject</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((t: any) => (
              <tr
                key={t.id}
                onClick={() => startEdit(t)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3">
                  <span className="font-medium text-gray-900">{t.label}</span>
                </td>
                <td className="px-5 py-3 text-gray-600">{t.subject}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit: ${editing?.label || ""}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Placeholder reference */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
              Placeholders
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {PLACEHOLDERS.map((p) => (
                <span key={p.key} className="text-blue-600">
                  <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">{p.key}</code>{" "}
                  <span className="text-blue-400">{p.desc}</span>
                </span>
              ))}
            </div>
          </div>

          <FormField label="Subject">
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className={inputClasses}
            />
          </FormField>
          <FormField label="Body">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className={textareaClasses + " font-mono text-xs"}
              rows={10}
            />
          </FormField>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMut.mutate({
                  data: {
                    id: editing.id,
                    subject: editSubject,
                    body: editBody,
                  },
                })
              }
              loading={updateMut.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
