import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { StatusBadge, Badge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, checkboxClasses } from "~/components/forms/FormField";
import type { VatRate } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/vat-rates")({
  component: VatRatesPage,
});

function VatRatesPage() {
  const supabase = getSupabaseBrowserClient();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<VatRate | null>(null);

  const { data: rates, isLoading } = useQuery({
    queryKey: ["vatRates"],
    queryFn: async () => {
      const { data } = await supabase.from("vat_rates").select("*").order("rate");
      return data as VatRate[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { name: string; rate: number; is_default: boolean }) => {
      if (input.is_default) {
        await supabase.from("vat_rates").update({ is_default: false }).eq("is_default", true);
      }
      const { error } = await supabase.from("vat_rates").insert(input);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vatRates"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name: string; rate: number; is_default: boolean; is_active: boolean }) => {
      if (input.is_default) {
        await supabase.from("vat_rates").update({ is_default: false }).eq("is_default", true);
      }
      const { error } = await supabase.from("vat_rates").update(input).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vatRates"] }); setEditing(null); },
  });

  const columns = [
    { key: "name", header: "Name", render: (r: VatRate) => <span className="font-medium">{r.name}</span> },
    { key: "rate", header: "Rate (%)", render: (r: VatRate) => `${Number(r.rate).toFixed(2)}%` },
    {
      key: "default", header: "Default",
      render: (r: VatRate) => r.is_default ? <Badge variant="info">Default</Badge> : <span className="text-gray-400">—</span>,
    },
    { key: "status", header: "Status", render: (r: VatRate) => <StatusBadge active={r.is_active} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (r: VatRate) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="VAT Rates" description="Manage VAT rates for invoicing." actions={<Button onClick={() => setShowCreate(true)}>Add Rate</Button>} />
      <DataTable columns={columns} data={rates ?? []} keyExtractor={(r) => r.id} loading={isLoading} />

      {showCreate && (
        <VatRateFormModal
          open onClose={() => setShowCreate(false)}
          onSubmit={(v) => createMut.mutate(v)}
          loading={createMut.isPending}
          title="Add VAT Rate"
        />
      )}
      {editing && (
        <VatRateFormModal
          open onClose={() => setEditing(null)}
          onSubmit={(v) => updateMut.mutate({ id: editing.id, ...v })}
          loading={updateMut.isPending}
          title="Edit VAT Rate"
          defaults={editing}
        />
      )}
    </div>
  );
}

function VatRateFormModal({ open, onClose, onSubmit, loading, title, defaults }: {
  open: boolean; onClose: () => void;
  onSubmit: (v: { name: string; rate: number; is_default: boolean; is_active: boolean }) => void;
  loading: boolean; title: string; defaults?: Partial<VatRate>;
}) {
  const [name, setName] = useState(defaults?.name || "");
  const [rate, setRate] = useState(defaults?.rate?.toString() || "");
  const [isDefault, setIsDefault] = useState(defaults?.is_default ?? false);
  const [isActive, setIsActive] = useState(defaults?.is_active ?? true);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, rate: parseFloat(rate || "0"), is_default: isDefault, is_active: isActive }); }} className="space-y-4">
        <FormField label="Name" required>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required placeholder="e.g. Standard Rate" />
        </FormField>
        <FormField label="Rate (%)" required>
          <input type="number" step="0.01" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} className={inputClasses} required placeholder="20.00" />
        </FormField>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className={checkboxClasses} />
          <span className="text-sm text-gray-700">Default rate</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className={checkboxClasses} />
          <span className="text-sm text-gray-700">Active</span>
        </label>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save" : "Add Rate"}</Button>
        </div>
      </form>
    </Modal>
  );
}
