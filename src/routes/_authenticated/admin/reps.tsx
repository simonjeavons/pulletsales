import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRepsFn, createRepFn, updateRepFn, toggleRepActiveFn } from "~/server/functions/reps";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { StatusBadge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, textareaClasses } from "~/components/forms/FormField";
import type { Rep } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/reps")({
  component: RepsPage,
});

function RepsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Rep | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Rep | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reps", search, statusFilter],
    queryFn: () => listRepsFn({ data: { search: search || undefined, is_active: statusFilter } }),
  });

  const createMut = useMutation({
    mutationFn: createRepFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reps"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: updateRepFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reps"] }); setEditing(null); },
  });

  const toggleMut = useMutation({
    mutationFn: toggleRepActiveFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reps"] }); setToggleTarget(null); },
  });

  const columns = [
    { key: "name", header: "Name", render: (r: Rep) => <span className="font-medium">{r.name}</span> },
    { key: "email", header: "Email", render: (r: Rep) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r: Rep) => r.phone || "—" },
    { key: "status", header: "Status", render: (r: Rep) => <StatusBadge active={r.is_active} /> },
    { key: "created", header: "Date Added", render: (r: Rep) => new Date(r.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", className: "text-right",
      render: (r: Rep) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setToggleTarget(r)}>
            {r.is_active ? "Archive" : "Restore"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Reps" description="Manage sales representatives." actions={<Button onClick={() => setShowCreate(true)}>Add Rep</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." className="w-80" />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(r) => r.id} loading={isLoading} />

      <RepFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Rep" />
      {editing && <RepFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: v } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Rep" defaults={editing} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_active: !toggleTarget.is_active } })} title={toggleTarget?.is_active ? "Archive Rep" : "Restore Rep"} message={`Are you sure you want to ${toggleTarget?.is_active ? "archive" : "restore"} ${toggleTarget?.name}?`} confirmLabel={toggleTarget?.is_active ? "Archive" : "Restore"} confirmVariant={toggleTarget?.is_active ? "danger" : "primary"} loading={toggleMut.isPending} />
    </div>
  );
}

function RepFormModal({ open, onClose, onSubmit, loading, error, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: Partial<Rep>;
}) {
  const [name, setName] = useState(defaults?.name || "");
  const [email, setEmail] = useState(defaults?.email || "");
  const [phone, setPhone] = useState(defaults?.phone || "");
  const [address, setAddress] = useState(defaults?.address || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email, phone, address, is_active: defaults?.is_active ?? true });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <FormField label="Name" required><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required /></FormField>
        <FormField label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Phone"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Address"><textarea value={address} onChange={(e) => setAddress(e.target.value)} className={textareaClasses} /></FormField>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Rep"}</Button>
        </div>
      </form>
    </Modal>
  );
}
