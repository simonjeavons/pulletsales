import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listRearersFn, createRearerFn, updateRearerFn, toggleRearerActiveFn } from "~/server/functions/rearers";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { StatusBadge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses } from "~/components/forms/FormField";
import type { Rearer } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/rearers")({
  component: RearersPage,
});

function RearersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Rearer | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Rearer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rearers", search, statusFilter],
    queryFn: () => listRearersFn({ data: { search: search || undefined, is_active: statusFilter } }),
  });

  const createMut = useMutation({ mutationFn: createRearerFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rearers"] }); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: updateRearerFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rearers"] }); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: toggleRearerActiveFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["rearers"] }); setToggleTarget(null); } });

  const columns = [
    { key: "name", header: "Name", render: (r: Rearer) => <span className="font-medium">{r.name}</span> },
    {
      key: "address", header: "Location",
      render: (r: Rearer) => {
        const parts = [r.town_city, r.post_code].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : "—";
      },
    },
    { key: "phone", header: "Phone", render: (r: Rearer) => r.phone || "—" },
    { key: "email", header: "Email", render: (r: Rearer) => r.email || "—" },
    { key: "status", header: "Status", render: (r: Rearer) => <StatusBadge active={r.is_active} /> },
    { key: "created", header: "Date Added", render: (r: Rearer) => new Date(r.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", className: "text-right",
      render: (r: Rearer) => (
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
      <PageHeader title="Rearers" description="Manage rearers." actions={<Button onClick={() => setShowCreate(true)}>Add Rearer</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name, post code, or email..." className="w-96" />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(r) => r.id} loading={isLoading} />

      <RearerFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Rearer" />
      {editing && <RearerFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: v } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Rearer" defaults={editing} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_active: !toggleTarget.is_active } })} title={toggleTarget?.is_active ? "Archive Rearer" : "Restore Rearer"} message={`Are you sure you want to ${toggleTarget?.is_active ? "archive" : "restore"} ${toggleTarget?.name}?`} confirmLabel={toggleTarget?.is_active ? "Archive" : "Restore"} confirmVariant={toggleTarget?.is_active ? "danger" : "primary"} loading={toggleMut.isPending} />
    </div>
  );
}

function RearerFormModal({ open, onClose, onSubmit, loading, error, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: Partial<Rearer>;
}) {
  const [name, setName] = useState(defaults?.name || "");
  const [addr1, setAddr1] = useState(defaults?.address_line_1 || "");
  const [addr2, setAddr2] = useState(defaults?.address_line_2 || "");
  const [town, setTown] = useState(defaults?.town_city || "");
  const [postCode, setPostCode] = useState(defaults?.post_code || "");
  const [email, setEmail] = useState(defaults?.email || "");
  const [phone, setPhone] = useState(defaults?.phone || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, address_line_1: addr1, address_line_2: addr2, town_city: town, post_code: postCode, email, phone, is_active: defaults?.is_active ?? true });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <FormField label="Rearer Name" required><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required /></FormField>
        <FormField label="Address Line 1"><input type="text" value={addr1} onChange={(e) => setAddr1(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Address Line 2"><input type="text" value={addr2} onChange={(e) => setAddr2(e.target.value)} className={inputClasses} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Town / City"><input type="text" value={town} onChange={(e) => setTown(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Post Code"><input type="text" value={postCode} onChange={(e) => setPostCode(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Contact Number"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Rearer"}</Button>
        </div>
      </form>
    </Modal>
  );
}
