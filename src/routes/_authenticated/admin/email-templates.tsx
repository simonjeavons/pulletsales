import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listEmailTemplatesFn,
  updateEmailTemplateFn,
} from "~/server/functions/email-templates";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses, textareaClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/_authenticated/admin/email-templates")({
  component: EmailTemplatesPage,
});

const PLACEHOLDERS = [
  { key: "{{order_number}}", desc: "Order number" },
  { key: "{{invoice_number}}", desc: "Invoice number" },
  { key: "{{customer_name}}", desc: "Customer company name" },
  { key: "{{rep_name}}", desc: "Rep name" },
  { key: "{{delivery_date}}", desc: "Delivery date" },
];

function EmailTemplatesPage() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
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
      setEditId(null);
    },
  });

  const startEdit = (t: any) => {
    setEditId(t.id);
    setEditSubject(t.subject);
    setEditBody(t.body);
  };

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
        description="Edit the subject and body for each email type. Use placeholders to insert dynamic data."
      />

      {/* Placeholder reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
          Available Placeholders
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {PLACEHOLDERS.map((p) => (
            <span key={p.key} className="text-blue-700">
              <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">
                {p.key}
              </code>{" "}
              <span className="text-blue-500">{p.desc}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {templates.map((t: any) => (
          <div
            key={t.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <span className="font-medium text-gray-900">{t.label}</span>
                <span className="text-xs text-gray-400 ml-3 font-mono">
                  {t.template_key}
                </span>
              </div>
              {editId !== t.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(t)}
                >
                  Edit
                </Button>
              )}
            </div>

            {editId === t.id ? (
              <div className="p-5 space-y-4">
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
                    rows={8}
                  />
                </FormField>
                <div className="flex gap-3">
                  <Button
                    onClick={() =>
                      updateMut.mutate({
                        data: {
                          id: t.id,
                          subject: editSubject,
                          body: editBody,
                        },
                      })
                    }
                    loading={updateMut.isPending}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 text-sm">
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    Subject:
                  </span>{" "}
                  <span className="text-gray-700">{t.subject}</span>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase">
                    Body:
                  </span>
                  <pre className="mt-1 text-gray-600 text-xs whitespace-pre-wrap font-sans bg-gray-50 rounded p-3 border border-gray-100">
                    {t.body}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
