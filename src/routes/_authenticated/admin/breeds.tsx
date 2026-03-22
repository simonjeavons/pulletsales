import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBreedsFn, createBreedFn, updateBreedFn, toggleBreedAvailableFn } from "~/server/functions/breeds";
import { getAvailableExtrasFn } from "~/server/functions/extras";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { AvailableBadge, Badge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, checkboxClasses } from "~/components/forms/FormField";
import type { BreedWithExtras } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/breeds")({
  component: BreedsPage,
});

function BreedsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [availableFilter, setAvailableFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BreedWithExtras | null>(null);
  const [toggleTarget, setToggleTarget] = useState<BreedWithExtras | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["breeds", search, availableFilter],
    queryFn: () => listBreedsFn({ data: { search: search || undefined, is_available: availableFilter } }),
  });

  const createMut = useMutation({ mutationFn: createBreedFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["breeds"] }); setShowCreate(false); } });
  const updateMut = useMutation({ mutationFn: updateBreedFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["breeds"] }); setEditing(null); } });
  const toggleMut = useMutation({ mutationFn: toggleBreedAvailableFn, onSuccess: () => { qc.invalidateQueries({ queryKey: ["breeds"] }); setToggleTarget(null); } });

  const columns = [
    { key: "name", header: "Breed Name", render: (b: BreedWithExtras) => <span className="font-medium">{b.breed_name}</span> },
    {
      key: "extras", header: "Linked Extras",
      render: (b: BreedWithExtras) => b.extras.length > 0
        ? <div className="flex flex-wrap gap-1">{b.extras.map((e) => <Badge key={e.id} variant="info">{e.name}</Badge>)}</div>
        : <span className="text-gray-400">None</span>,
    },
    { key: "available", header: "Available", render: (b: BreedWithExtras) => <AvailableBadge available={b.is_available} /> },
    { key: "created", header: "Date Added", render: (b: BreedWithExtras) => new Date(b.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", className: "text-right",
      render: (b: BreedWithExtras) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(b)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setToggleTarget(b)}>
            {b.is_available ? "Mark Unavailable" : "Mark Available"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Breeds" description="Manage breeds and their linked extras." actions={<Button onClick={() => setShowCreate(true)}>Add Breed</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search breeds..." className="w-80" />
        <StatusFilter value={availableFilter} onChange={setAvailableFilter} activeLabel="Available" inactiveLabel="Unavailable" />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(b) => b.id} loading={isLoading} />

      <BreedFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Breed" />
      {editing && <BreedFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: { breed_name: v.breed_name, is_available: v.is_available }, extra_ids: v.extra_ids } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Breed" defaults={editing} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_available: !toggleTarget.is_available } })} title={toggleTarget?.is_available ? "Mark Unavailable" : "Mark Available"} message={`Are you sure you want to mark "${toggleTarget?.breed_name}" as ${toggleTarget?.is_available ? "unavailable" : "available"}?`} confirmLabel="Confirm" confirmVariant="primary" loading={toggleMut.isPending} />
    </div>
  );
}

function BreedFormModal({ open, onClose, onSubmit, loading, error, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: BreedWithExtras;
}) {
  const [breedName, setBreedName] = useState(defaults?.breed_name || "");
  const [isAvailable, setIsAvailable] = useState(defaults?.is_available ?? true);
  const [selectedExtras, setSelectedExtras] = useState<string[]>(defaults?.extras.map((e) => e.id) || []);

  const { data: availableExtras } = useQuery({
    queryKey: ["availableExtras"],
    queryFn: () => getAvailableExtrasFn(),
  });

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ breed_name: breedName, is_available: isAvailable, extra_ids: selectedExtras });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <FormField label="Breed Name" required>
          <input type="text" value={breedName} onChange={(e) => setBreedName(e.target.value)} className={inputClasses} required />
        </FormField>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className={checkboxClasses} />
          <span className="text-sm text-gray-700">Available for order forms</span>
        </label>
        <FormField label="Linked Extras">
          <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
            {(availableExtras ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No available extras</p>
            ) : (
              (availableExtras ?? []).map((extra) => (
                <label key={extra.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedExtras.includes(extra.id)}
                    onChange={() => toggleExtra(extra.id)}
                    className={checkboxClasses}
                  />
                  <span className="text-sm text-gray-700">{extra.name}</span>
                </label>
              ))
            )}
          </div>
        </FormField>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Breed"}</Button>
        </div>
      </form>
    </Modal>
  );
}
