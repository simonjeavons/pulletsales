import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

interface Setting {
  key: string;
  value: string;
  description: string | null;
}

const settingGroups = [
  {
    title: "Numbering Sequences",
    description: "Next numbers to be assigned automatically.",
    settings: [
      { key: "next_order_number", label: "Next Order Number", type: "number" },
      { key: "next_despatch_number", label: "Next Despatch Number", type: "number" },
      { key: "next_invoice_number", label: "Next Invoice Number", type: "number" },
    ],
  },
  {
    title: "Food Clause",
    description: "Food clause adjustment calculation settings.",
    settings: [
      { key: "food_clause_multiplier", label: "Multiplier", type: "number" },
    ],
  },
  {
    title: "TAS Export Defaults",
    description: "Default values used when generating TAS CSV exports.",
    settings: [
      { key: "tas_nominal", label: "Default Nominal Code", type: "text" },
      { key: "tas_depot", label: "Default Depot Code", type: "text" },
    ],
  },
];

function SettingsPage() {
  const supabase = getSupabaseBrowserClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase
      .from("system_settings")
      .select("key, value")
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((s: any) => { map[s.key] = s.value; });
        setValues(map);
        setLoading(false);
      });
  }, []);

  const saveMut = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase
          .from("system_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setSuccess("Settings saved");
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  const handleSave = () => {
    saveMut.mutate(values);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure system-wide settings."
        actions={
          <Button onClick={handleSave} loading={saveMut.isPending}>
            Save All Settings
          </Button>
        }
      />

      {success && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200 mb-6">
          {success}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {settingGroups.map((group) => (
          <div key={group.title} className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{group.title}</h3>
            {(group as any).description && <p className="text-sm text-gray-500 mb-4">{(group as any).description}</p>}
            <div className="space-y-4">
              {group.settings.map((s) => (
                <FormField key={s.key} label={s.label}>
                  <input
                    type={s.type}
                    value={values[s.key] || ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    className={inputClasses}
                  />
                </FormField>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
