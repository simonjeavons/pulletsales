import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const supabase = getSupabaseBrowserClient();
  const [nextOrderNumber, setNextOrderNumber] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "next_order_number")
      .single()
      .then(({ data }) => {
        const val = data?.value || "50001";
        setNextOrderNumber(val);
        setCurrentValue(val);
        setLoading(false);
      });
  }, []);

  const saveMut = useMutation({
    mutationFn: async (value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) throw new Error("Must be a valid positive number");

      const { error } = await supabase
        .from("system_settings")
        .update({ value: String(num), updated_at: new Date().toISOString() })
        .eq("key", "next_order_number");

      if (error) throw new Error(error.message);
      return num;
    },
    onSuccess: (num) => {
      setCurrentValue(String(num));
      setSuccess(`Next order number set to ${num}`);
      setTimeout(() => setSuccess(""), 3000);
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="System Settings" description="Configure system-wide settings." />

      <div className="max-w-lg space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Order Numbering</h3>
          <p className="text-sm text-gray-500 mb-4">
            Set the next order number to be assigned. Current value: <strong>{currentValue}</strong>
          </p>

          {success && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200 mb-4">
              {success}
            </div>
          )}

          {saveMut.error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
              {(saveMut.error as Error).message}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate(nextOrderNumber);
            }}
            className="flex items-end gap-3"
          >
            <FormField label="Next Order Number" className="flex-1">
              <input
                type="number"
                min="1"
                value={nextOrderNumber}
                onChange={(e) => setNextOrderNumber(e.target.value)}
                className={inputClasses}
                placeholder="e.g. 50001"
              />
            </FormField>
            <Button type="submit" loading={saveMut.isPending}>
              Save
            </Button>
          </form>

          <p className="text-xs text-gray-400 mt-3">
            Orders will be numbered sequentially from this value. Numbers are plain digits (e.g. 50001, 50002, 50003...).
          </p>
        </div>
      </div>
    </div>
  );
}
