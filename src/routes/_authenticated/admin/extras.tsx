import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listExtrasFn, createExtraFn, updateExtraFn, toggleExtraAvailableFn } from "~/server/functions/extras";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { AvailableBadge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, textareaClasses, checkboxClasses } from "~/components/forms/FormField";
import type { Extra } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/extras")({
  component: ExtrasPage,
});

function ExtrasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [availableFilter, setAvailableFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Extra | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Extra | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["extras", search, availableFilter],
    queryFn: () => listExtrasFn({ data: { search: search || undefined, is_available: availableFilter } }),
  });

  const createMut = useMutation({ mutationFn: createExtraFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["extras"] }); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: updateExtraFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["extras"] }); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: toggleExtraAvailableFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["extras"] }); setToggleTarget(null); } });

  const columns = [
    { key: "name", header: "Name", render: (e: Extra) => <span className="font-medium">{e.name}</span> },
    { key: "desc", header: "Description", render: (e: Extra) => e.description || "—" },
    { key: "available", header: "Available", render: (e: Extra) => <AvailableBadge available={e.is_available} /> },
    { key: "created", header: "Date Added", render: (e: Extra) => new Date(e.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", className: "text-right",
      render: (e: Extra) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(e)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setToggleTarget(e)}>
            {e.is_available ? "Mark Unavailable" : "Mark Available"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Extras" description="Manage extras that can be linked to breeds." actions={<Button onClick={() => setShowCreate(true)}>Add Extra</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search extras..." className="w-80" />
        <StatusFilter value={availableFilter} onChange={setAvailableFilter} activeLabel="Available" inactiveLabel="Unavailable" />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(e) => e.id} loading={isLoading} />

      <ExtraFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Extra" />
      {editing && <ExtraFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: v } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Extra" defaults={editing} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_available: !toggleTarget.is_available } })} title={toggleTarget?.is_available ? "Mark Unavailable" : "Mark Available"} message={`Are you sure you want to mark "${toggleTarget?.name}" as ${toggleTarget?.is_available ? "unavailable" : "available"}?`} confirmLabel="Confirm" confirmVariant="primary" loading={toggleMut.isPending} />
    </div>
  );
}

function ExtraFormModal({ open, onClose, onSubmit, loading, error, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: Partial<Extra>;
}) {
  const [name, setName] = useState(defaults?.name || "");
  const [description, setDescription] = useState(defaults?.description || "");
  const [isAvailable, setIsAvailable] = useState(defaults?.is_available ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, description, is_available: isAvailable });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <FormField label="Name" required><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required /></FormField>
        <FormField label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaClasses} /></FormField>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className={checkboxClasses} />
          <span className="text-sm text-gray-700">Available for breed selection</span>
        </label>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Extra"}</Button>
        </div>
      </form>
    </Modal>
  );
}
