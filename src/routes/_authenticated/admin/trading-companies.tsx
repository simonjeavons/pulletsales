import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { StatusBadge, Badge } from "~/components/ui/Badge";
import { Modal } from "~/components/ui/Modal";
import { FormField, inputClasses, checkboxClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/_authenticated/admin/trading-companies")({
  component: TradingCompaniesPage,
});

function TradingCompaniesPage() {
  const supabase = getSupabaseBrowserClient();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["tradingCompanies"],
    queryFn: async () => {
      const { data } = await supabase.from("trading_companies").select("*").order("code");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: any) => {
      if (input.is_default) {
        await supabase.from("trading_companies").update({ is_default: false }).eq("is_default", true);
      }
      const { error } = await supabase.from("trading_companies").insert(input);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tradingCompanies"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...input }: any) => {
      if (input.is_default) {
        await supabase.from("trading_companies").update({ is_default: false }).eq("is_default", true);
      }
      const { error } = await supabase.from("trading_companies").update(input).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tradingCompanies"] }); setEditing(null); },
  });

  const columns = [
    { key: "code", header: "Code", render: (c: any) => <span className="font-mono font-medium">{c.code}</span> },
    { key: "name", header: "Name", render: (c: any) => c.name },
    { key: "vat", header: "VAT Reg", render: (c: any) => c.vat_registration || "—" },
    { key: "default", header: "Default", render: (c: any) => c.is_default ? <Badge variant="info">Default</Badge> : <span className="text-gray-400">—</span> },
    { key: "status", header: "Status", render: (c: any) => <StatusBadge active={c.is_active} /> },
    {
      key: "actions", header: "", className: "text-right",
      render: (c: any) => <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>,
    },
  ];

  return (
    <div>
      <PageHeader title="Trading Companies" description="Manage trading companies — each can have its own address, VAT, and bank details for documents." actions={<Button onClick={() => setShowCreate(true)}>Add Company</Button>} />
      <DataTable columns={columns} data={companies ?? []} keyExtractor={(c: any) => c.id} loading={isLoading} />

      {showCreate && (
        <TradingCompanyForm open onClose={() => setShowCreate(false)} onSubmit={(v) => createMut.mutate(v)} loading={createMut.isPending} title="Add Trading Company" />
      )}
      {editing && (
        <TradingCompanyForm open onClose={() => setEditing(null)} onSubmit={(v) => updateMut.mutate({ id: editing.id, ...v })} loading={updateMut.isPending} title="Edit Trading Company" defaults={editing} />
      )}
    </div>
  );
}

function TradingCompanyForm({ open, onClose, onSubmit, loading, title, defaults }: {
  open: boolean; onClose: () => void; onSubmit: (v: any) => void; loading: boolean; title: string; defaults?: any;
}) {
  const [code, setCode] = useState(defaults?.code || "");
  const [name, setName] = useState(defaults?.name || "");
  const [addressLine1, setAddressLine1] = useState(defaults?.address_line_1 || "");
  const [addressLine2, setAddressLine2] = useState(defaults?.address_line_2 || "");
  const [townCity, setTownCity] = useState(defaults?.town_city || "");
  const [county, setCounty] = useState(defaults?.county || "");
  const [postCode, setPostCode] = useState(defaults?.post_code || "");
  const [telephone, setTelephone] = useState(defaults?.telephone || "");
  const [fax, setFax] = useState(defaults?.fax || "");
  const [registeredOffice, setRegisteredOffice] = useState(defaults?.registered_office || "");
  const [registeredNumber, setRegisteredNumber] = useState(defaults?.registered_number || "");
  const [vatRegistration, setVatRegistration] = useState(defaults?.vat_registration || "");
  const [bankName, setBankName] = useState(defaults?.bank_name || "");
  const [bankSortCode, setBankSortCode] = useState(defaults?.bank_sort_code || "");
  const [bankAccountNo, setBankAccountNo] = useState(defaults?.bank_account_no || "");
  const [paymentTermsDays, setPaymentTermsDays] = useState(defaults?.payment_terms_days?.toString() || "7");
  const [isDefault, setIsDefault] = useState(defaults?.is_default ?? false);
  const [isActive, setIsActive] = useState(defaults?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      code: code.toUpperCase(), name,
      address_line_1: addressLine1 || null, address_line_2: addressLine2 || null,
      town_city: townCity || null, county: county || null, post_code: postCode || null,
      telephone: telephone || null, fax: fax || null,
      registered_office: registeredOffice || null, registered_number: registeredNumber || null,
      vat_registration: vatRegistration || null,
      bank_name: bankName || null, bank_sort_code: bankSortCode || null, bank_account_no: bankAccountNo || null,
      payment_terms_days: parseInt(paymentTermsDays || "7", 10),
      is_default: isDefault, is_active: isActive,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Identity</h4>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Code (3 chars)" required>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.slice(0, 3))} className={inputClasses} required maxLength={3} style={{ textTransform: "uppercase" }} />
            </FormField>
            <div className="col-span-2">
              <FormField label="Company Name" required>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} required />
              </FormField>
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Address</h4>
          <div className="space-y-3">
            <FormField label="Address Line 1"><input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputClasses} /></FormField>
            <FormField label="Address Line 2"><input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputClasses} /></FormField>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Town / City"><input type="text" value={townCity} onChange={(e) => setTownCity(e.target.value)} className={inputClasses} /></FormField>
              <FormField label="County"><input type="text" value={county} onChange={(e) => setCounty(e.target.value)} className={inputClasses} /></FormField>
              <FormField label="Post Code"><input type="text" value={postCode} onChange={(e) => setPostCode(e.target.value)} className={inputClasses} /></FormField>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Contact</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Telephone"><input type="text" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClasses} /></FormField>
            <FormField label="Fax"><input type="text" value={fax} onChange={(e) => setFax(e.target.value)} className={inputClasses} /></FormField>
          </div>
        </div>

        {/* Registration */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Registration</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Registered Office"><input type="text" value={registeredOffice} onChange={(e) => setRegisteredOffice(e.target.value)} className={inputClasses} /></FormField>
            <FormField label="Registered Number"><input type="text" value={registeredNumber} onChange={(e) => setRegisteredNumber(e.target.value)} className={inputClasses} /></FormField>
          </div>
          <FormField label="VAT Registration" className="mt-3"><input type="text" value={vatRegistration} onChange={(e) => setVatRegistration(e.target.value)} className={inputClasses} /></FormField>
        </div>

        {/* Bank */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Bank Details</h4>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Bank Name"><input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClasses} /></FormField>
            <FormField label="Sort Code"><input type="text" value={bankSortCode} onChange={(e) => setBankSortCode(e.target.value)} className={inputClasses} /></FormField>
            <FormField label="Account Number"><input type="text" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} className={inputClasses} /></FormField>
          </div>
        </div>

        {/* Terms & Flags */}
        <div className="grid grid-cols-3 gap-4 items-end">
          <FormField label="Payment Terms (days)">
            <input type="number" min="0" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} className={inputClasses} />
          </FormField>
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className={checkboxClasses} />
            <span className="text-sm text-gray-700">Default for new orders</span>
          </label>
          {defaults && (
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className={checkboxClasses} />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{defaults ? "Save" : "Add Company"}</Button>
        </div>
      </form>
    </Modal>
  );
}
