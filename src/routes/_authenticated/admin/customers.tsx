import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCustomersFn, createCustomerFn, updateCustomerFn, toggleCustomerActiveFn,
  listDeliveryAddressesFn, createDeliveryAddressFn, updateDeliveryAddressFn, toggleDeliveryAddressActiveFn,
} from "~/server/functions/customers";
import { getActiveRepsFn } from "~/server/functions/reps";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar, StatusFilter } from "~/components/ui/SearchBar";
import { StatusBadge } from "~/components/ui/Badge";
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import { FormField, inputClasses, selectClasses, textareaClasses } from "~/components/forms/FormField";
import type { Customer, CustomerWithRep, DeliveryAddress } from "~/types/database";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CustomerWithRep | null>(null);
  const [toggleTarget, setToggleTarget] = useState<CustomerWithRep | null>(null);
  const [addressCustomer, setAddressCustomer] = useState<CustomerWithRep | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, statusFilter],
    queryFn: () => listCustomersFn({ data: { search: search || undefined, is_active: statusFilter } }),
  });

  const { data: reps } = useQuery({ queryKey: ["activeReps"], queryFn: () => getActiveRepsFn() });

  const createMut = useMutation({
    mutationFn: createCustomerFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: updateCustomerFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setEditing(null); },
  });
  const toggleMut = useMutation({
    mutationFn: toggleCustomerActiveFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setToggleTarget(null); },
  });

  const columns = [
    { key: "uid", header: "ID", render: (c: CustomerWithRep) => <span className="font-mono text-xs">{c.customer_unique_id}</span> },
    { key: "name", header: "Company", render: (c: CustomerWithRep) => <span className="font-medium">{c.company_name}</span> },
    { key: "postcode", header: "Post Code", render: (c: CustomerWithRep) => c.post_code || "—" },
    { key: "rep", header: "Rep", render: (c: CustomerWithRep) => (c as any).rep?.name || "—" },
    { key: "status", header: "Status", render: (c: CustomerWithRep) => <StatusBadge active={c.is_active} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (c: CustomerWithRep) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAddressCustomer(c)}>Addresses</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setToggleTarget(c)}>
            {c.is_active ? "Archive" : "Restore"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Customers" description="Manage customer accounts." actions={<Button onClick={() => setShowCreate(true)}>Add Customer</Button>} />
      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by ID, company, or post code..." className="w-96" />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>
      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(c) => c.id} loading={isLoading} />

      <CustomerFormModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate({ data: v })} loading={createMut.isPending} error={createMut.error?.message} title="Add Customer" reps={reps ?? []} />
      {editing && <CustomerFormModal open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ data: { id: editing.id, updates: v } })} loading={updateMut.isPending} error={updateMut.error?.message} title="Edit Customer" defaults={editing} reps={reps ?? []} />}
      <ConfirmModal open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={() => toggleTarget && toggleMut.mutate({ data: { id: toggleTarget.id, is_active: !toggleTarget.is_active } })} title={toggleTarget?.is_active ? "Archive Customer" : "Restore Customer"} message={`Are you sure you want to ${toggleTarget?.is_active ? "archive" : "restore"} ${toggleTarget?.company_name}?`} confirmLabel={toggleTarget?.is_active ? "Archive" : "Restore"} confirmVariant={toggleTarget?.is_active ? "danger" : "primary"} loading={toggleMut.isPending} />
      {addressCustomer && <DeliveryAddressesModal customer={addressCustomer} onClose={() => setAddressCustomer(null)} />}
    </div>
  );
}

// ─── Customer Form Modal ─────────────────────────────────
function CustomerFormModal({ open, onClose, onSubmit, loading, error, title, defaults, reps }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; error?: string; title: string; defaults?: Partial<Customer>; reps: { id: string; name: string }[];
}) {
  const [uid, setUid] = useState(defaults?.customer_unique_id || "");
  const [companyName, setCompanyName] = useState(defaults?.company_name || "");
  const [addr1, setAddr1] = useState(defaults?.address_line_1 || "");
  const [addr2, setAddr2] = useState(defaults?.address_line_2 || "");
  const [town, setTown] = useState(defaults?.town_city || "");
  const [postCode, setPostCode] = useState(defaults?.post_code || "");
  const [contactName, setContactName] = useState((defaults as any)?.contact_name || "");
  const [email, setEmail] = useState((defaults as any)?.email || "");
  const [repId, setRepId] = useState(defaults?.rep_id || "");
  const [paymentTerms, setPaymentTerms] = useState(String((defaults as any)?.payment_terms_days ?? "7"));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ customer_unique_id: uid, company_name: companyName, address_line_1: addr1, address_line_2: addr2, town_city: town, post_code: postCode, contact_name: contactName || undefined, email: email || undefined, rep_id: repId || undefined, payment_terms_days: parseInt(paymentTerms, 10) || 7, is_active: defaults?.is_active ?? true });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Customer ID" required><input type="text" value={uid} onChange={(e) => setUid(e.target.value)} className={inputClasses} required /></FormField>
          <FormField label="Company Name" required><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClasses} required /></FormField>
        </div>
        <FormField label="Address Line 1"><input type="text" value={addr1} onChange={(e) => setAddr1(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Address Line 2"><input type="text" value={addr2} onChange={(e) => setAddr2(e.target.value)} className={inputClasses} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Town / City"><input type="text" value={town} onChange={(e) => setTown(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Post Code"><input type="text" value={postCode} onChange={(e) => setPostCode(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact Name"><input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClasses} placeholder="e.g. Mr T. Lecount" /></FormField>
          <FormField label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="customer@example.com" /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Assigned Rep">
            <select value={repId} onChange={(e) => setRepId(e.target.value)} className={selectClasses}>
              <option value="">— Select a rep —</option>
              {reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </FormField>
          <FormField label="Payment Terms (days)">
            <input type="number" min="0" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputClasses} placeholder="7" />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save Changes" : "Add Customer"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delivery Addresses Modal ────────────────────────────
function DeliveryAddressesModal({ customer, onClose }: { customer: CustomerWithRep; onClose: () => void }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingAddr, setEditingAddr] = useState<DeliveryAddress | null>(null);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["deliveryAddresses", customer.id],
    queryFn: () => listDeliveryAddressesFn({ data: { customerId: customer.id } }),
  });

  const createMut = useMutation({
    mutationFn: createDeliveryAddressFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveryAddresses", customer.id] }); setShowAdd(false); },
  });

  const updateMut = useMutation({
    mutationFn: updateDeliveryAddressFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveryAddresses", customer.id] }); setEditingAddr(null); },
  });

  const toggleMut = useMutation({
    mutationFn: toggleDeliveryAddressActiveFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveryAddresses", customer.id] }),
  });

  return (
    <Modal open onClose={onClose} title={`Delivery Addresses — ${customer.company_name}`} size="lg">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">{(addresses ?? []).length} address(es)</p>
          <Button size="sm" onClick={() => setShowAdd(true)}>Add Address</Button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : (
          <div className="space-y-3">
            {(addresses ?? []).map((addr) => (
              <div key={addr.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{addr.label}</p>
                    <p className="text-sm text-gray-600">
                      {[addr.address_line_1, addr.address_line_2, addr.town_city, addr.post_code].filter(Boolean).join(", ")}
                    </p>
                    {addr.delivery_notes && <p className="text-sm text-gray-500 mt-1 italic">Notes: {addr.delivery_notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge active={addr.is_active} />
                    <Button variant="ghost" size="sm" onClick={() => setEditingAddr(addr)}>Edit</Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => toggleMut.mutate({ data: { id: addr.id, is_active: !addr.is_active } })}
                    >
                      {addr.is_active ? "Archive" : "Restore"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddressFormModal
          open onClose={() => setShowAdd(false)}
          onSubmit={(v) => createMut.mutate({ data: { customerId: customer.id, input: v } })}
          loading={createMut.isPending}
          title="Add Delivery Address"
        />
      )}
      {editingAddr && (
        <AddressFormModal
          open onClose={() => setEditingAddr(null)}
          onSubmit={(v) => updateMut.mutate({ data: { id: editingAddr.id, updates: v } })}
          loading={updateMut.isPending}
          title="Edit Delivery Address"
          defaults={editingAddr}
        />
      )}
    </Modal>
  );
}

function AddressFormModal({ open, onClose, onSubmit, loading, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; title: string; defaults?: Partial<DeliveryAddress>;
}) {
  const [label, setLabel] = useState(defaults?.label || "");
  const [addr1, setAddr1] = useState(defaults?.address_line_1 || "");
  const [addr2, setAddr2] = useState(defaults?.address_line_2 || "");
  const [town, setTown] = useState(defaults?.town_city || "");
  const [postCode, setPostCode] = useState(defaults?.post_code || "");
  const [notes, setNotes] = useState(defaults?.delivery_notes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ label, address_line_1: addr1, address_line_2: addr2, town_city: town, post_code: postCode, delivery_notes: notes, is_active: defaults?.is_active ?? true });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Label / Name" required><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClasses} required placeholder="e.g. Farm Gate, Main Yard" /></FormField>
        <FormField label="Address Line 1"><input type="text" value={addr1} onChange={(e) => setAddr1(e.target.value)} className={inputClasses} /></FormField>
        <FormField label="Address Line 2"><input type="text" value={addr2} onChange={(e) => setAddr2(e.target.value)} className={inputClasses} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Town / City"><input type="text" value={town} onChange={(e) => setTown(e.target.value)} className={inputClasses} /></FormField>
          <FormField label="Post Code"><input type="text" value={postCode} onChange={(e) => setPostCode(e.target.value)} className={inputClasses} /></FormField>
        </div>
        <FormField label="Delivery Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaClasses} placeholder="Special delivery instructions..." /></FormField>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save" : "Add Address"}</Button>
        </div>
      </form>
    </Modal>
  );
}
