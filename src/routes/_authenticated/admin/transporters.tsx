import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTransportersFn, createTransporterFn, updateTransporterFn, toggleTransporterActiveFn } from "~/server/functions/transporters";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { StatusBadge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses } from "~/components/forms/FormField";
import type { Transporter } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/transporters")({
  component: TransportersPage,
});

function TransportersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Transporter | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Transporter | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["transporters", search, statusFilter],
    queryFn: () => listTransportersFn({ data: { search: search || undefined, is_active: statusFilter } }),
  });

  const createMut = useMutation({ mutationFn: createTransporterFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["transporters"] }); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: updateTransporterFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["transporters"] }); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: toggleTransporterActiveFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["transporters"] }); setToggleTarget(null); } });

  const columns = [
    { key: "name", header: "Name", render: (t: Transporter) => <span className="font-medium">{t.transporter_name}</span> },
    { key: "postcode", header: "Post Code", render: (t: Transporter) => t.post_code || "—" },
    { key: "phone", header: "Phone", render: (t: Transporter) => t.phone || "—" },
    { key: "email", header: "Email", render: (t: Transporter) => t.email || "—" },
    { key: "status", header: "Status", render: (t: Transporter) => <StatusBadge active={t.is_active} /> },
    { key: "created", header: "Date Added", render: (t: Transporter) => new Date(t.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", className: "text-right",
      render: (t: Transporter) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setToggleTarget(t)}>
            {t.is_active ? "Archive" : "Restore"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Transporters" description="Manage transport providers." actions={<Button onClick={() => setShowCreate(true)}>Add Transporter</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or post code..." className="w-80" />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(t) => t.id} loading={isLoading} />

      <TransporterFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Transporter" />
      {editing && <TransporterFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: v } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Transporter" defaults={editing} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_active: !toggleTarget.is_active } })} title={toggleTarget?.is_active ? "Archive Transporter" : "Restore Transporter"} message={`Are you sure you want to ${toggleTarget?.is_active ? "archive" : "restore"} ${toggleTarget?.transporter_name}?`} confirmLabel={toggleTarget?.is_active ? "Archive" : "Restore"} confirmVariant={toggleTarget?.is_active ? "danger" : "primary"} loading={toggleMut.isPending} />
    </div>
  );
}

function TransporterFormModal({ open, onClose, onSubmit, loading, error, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: Partial<Transporter>;
}) {
  const [name, setName] = useState(defaults?.transporter_name || "");
  const [addr1, setAddr1] = useState(defaults?.address_line_1 || "");
  const [addr2, setAddr2] = useState(defaults?.address_line_2 || "");
  const [town, setTown] = useState(defaults?.town_city || "");
  const [postCode, setPostCode] = useState(defaults?.post_code || "");
  const [phone, setPhone] = useState(defaults?.phone || "");
  const [email, setEmail] = useState(defaults?.email || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ transporter_name: name, address_line_1: addr1, address_line_2: addr2, town_city: town, post_code: postCode, phone, email, is_active: defaults?.is_active ?? true });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <FormField label="Transporter Name" required><input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required /></FormField>
        <FormField label="Address Line 1"><input type="text" value={addr1} onChange={(e) => setAddr1(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Address Line 2"><input type="text" value={addr2} onChange={(e) => setAddr2(e.target.value)} className={inputClasses} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Town / City"><input type="text" value={town} onChange={(e) => setTown(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Post Code"><input type="text" value={postCode} onChange={(e) => setPostCode(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Phone"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Transporter"}</Button>
        </div>
      </form>
    </Modal>
  );
}
