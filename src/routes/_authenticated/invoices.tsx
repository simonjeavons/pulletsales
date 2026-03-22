import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import {
  listInvoicesFn,
  finaliseInvoiceFn,
  exportInvoicesFn,
  generateInvoiceCsvFn,
} from "~/server/functions/invoices";
import { listOrdersFn } from "~/server/functions/orders";
import { createInvoiceFn } from "~/server/functions/invoices";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar } from "~/components/ui/SearchBar";
import { Badge } from "~/components/ui/Badge";
import { Modal } from "~/components/ui/Modal";
import { FormField, inputClasses, selectClasses } from "~/components/forms/FormField";
import type { InvoiceStatus, InvoiceWithRelations, VatRate } from "~/types/database";

export const Route = createFileRoute("/_authenticated/invoices")({
  component: InvoicesPage,
});

const statusColors: Record<InvoiceStatus, "success" | "warning" | "info" | "neutral" | "danger"> = {
  draft: "neutral",
  finalised: "info",
  exported: "success",
  void: "danger",
};

function InvoicesPage() {
  const qc = useQueryClient();
  const supabase = getSupabaseBrowserClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [vatRates, setVatRates] = useState<VatRate[]>([]);

  useEffect(() => {
    supabase.from("vat_rates").select("*").eq("is_active", true).order("rate")
      .then(({ data }) => setVatRates(data ?? []));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search, statusFilter],
    queryFn: () =>
      listInvoicesFn({ data: { search: search || undefined, status: statusFilter || undefined } }),
  });

  const { data: completedOrders } = useQuery({
    queryKey: ["completedOrders"],
    queryFn: () => listOrdersFn({ data: { status: "completed" } }),
    enabled: showCreateModal,
  });

  const createMut = useMutation({
    mutationFn: createInvoiceFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["completedOrders"] });
      setShowCreateModal(false);
    },
  });

  const adHocMut = useMutation({
    mutationFn: async (input: { invoice_number: string; customer_id: string; invoice_date: string; vat_rate_id: string }) => {
      const { error } = await supabase.from("invoices").insert({
        ...input,
        order_id: null,
        status: "draft",
        export_status: "pending",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setShowAdHocModal(false);
    },
  });

  const finaliseMut = useMutation({
    mutationFn: finaliseInvoiceFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const exportMut = useMutation({
    mutationFn: exportInvoicesFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds([]);
    },
  });

  const handleExportCsv = async () => {
    const csvData = await generateInvoiceCsvFn({ data: { invoiceIds: selectedIds } });
    if (!csvData || csvData.length === 0) return;

    // TAS format: no headers, just comma-separated values
    // TAS format columns in order
    const cols = ["type", "customer_ref", "nominal", "depot", "invoice_date", "invoice_number", "details", "grand_total", "vat_code", "tax_amount"];
    const csvContent = csvData.map((row: any) =>
      cols.map((c) => String(row[c] ?? "")).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    exportMut.mutate({ data: { invoiceIds: selectedIds } });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const columns = [
    {
      key: "select", header: "",
      render: (inv: any) => (
        <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 rounded border-gray-300" />
      ),
    },
    { key: "number", header: "Invoice #", render: (inv: any) => <span className="font-medium">{inv.invoice_number}</span> },
    { key: "order", header: "Order", render: (inv: any) => inv.order?.order_number || "Ad-hoc" },
    { key: "custRef", header: "Ref", render: (inv: any) => <span className="font-mono text-xs">{inv.customer?.customer_unique_id || "—"}</span> },
    { key: "customer", header: "Customer", render: (inv: any) => inv.customer?.company_name || "—" },
    { key: "date", header: "Date", render: (inv: any) => new Date(inv.invoice_date).toLocaleDateString() },
    { key: "vat", header: "VAT", render: (inv: any) => {
      const rate = vatRates.find((r) => r.id === inv.vat_rate_id);
      return rate ? `${Number(rate.rate).toFixed(2)}%` : "—";
    }},
    { key: "status", header: "Status", render: (inv: any) => <Badge variant={statusColors[inv.status as InvoiceStatus]}>{inv.status}</Badge> },
    { key: "exported", header: "Exported", render: (inv: any) => inv.exported_at ? <Badge variant="success">Yes</Badge> : <Badge variant="neutral">No</Badge> },
    {
      key: "actions", header: "", className: "text-right",
      render: (inv: any) => (
        <div className="flex justify-end gap-2">
          {inv.status === "draft" && (
            <Button variant="ghost" size="sm" onClick={() => finaliseMut.mutate({ data: { id: inv.id } })}>Finalise</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Manage and export invoices."
        actions={
          <div className="flex gap-3">
            {selectedIds.length > 0 && (
              <Button variant="secondary" onClick={handleExportCsv}>
                Export {selectedIds.length} to CSV
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowAdHocModal(true)}>Ad-hoc Invoice</Button>
            <Button onClick={() => setShowCreateModal(true)}>From Order</Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by invoice number..." className="w-80" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="finalised">Finalised</option>
          <option value="exported">Exported</option>
          <option value="void">Void</option>
        </select>
        <button
          onClick={() => setStatusFilter(statusFilter === "exported" ? "" : "exported")}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
            statusFilter === "exported"
              ? "bg-green-50 border-green-300 text-green-700"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {statusFilter === "exported" ? "✓ Showing Exported" : "Show Exported Only"}
        </button>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(inv: any) => inv.id} loading={isLoading} emptyMessage="No invoices found." />

      {/* From Order Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Invoice from Completed Order">
        <div className="space-y-3">
          {(completedOrders?.data ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">No completed orders available for invoicing.</p>
          ) : (
            (completedOrders?.data ?? []).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                <div>
                  <span className="font-medium">{order.order_number}</span>
                  <span className="text-gray-500 text-sm ml-2">{order.customer?.company_name}</span>
                </div>
                <Button size="sm" onClick={() => createMut.mutate({ data: { orderId: order.id } })} loading={createMut.isPending}>
                  Create Invoice
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Ad-hoc Invoice Modal */}
      <AdHocInvoiceModal
        open={showAdHocModal}
        onClose={() => setShowAdHocModal(false)}
        onSubmit={(v) => adHocMut.mutate(v)}
        loading={adHocMut.isPending}
        vatRates={vatRates}
      />
    </div>
  );
}

function AdHocInvoiceModal({ open, onClose, onSubmit, loading, vatRates }: {
  open: boolean; onClose: () => void;
  onSubmit: (v: { invoice_number: string; customer_id: string; invoice_date: string; vat_rate_id: string }) => void;
  loading: boolean; vatRates: VatRate[];
}) {
  const supabase = getSupabaseBrowserClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [vatRateId, setVatRateId] = useState(vatRates.find((r) => r.is_default)?.id || "");

  useEffect(() => {
    supabase.from("customers").select("id, company_name, customer_unique_id").eq("is_active", true).order("company_name")
      .then(({ data }) => setCustomers(data ?? []));
  }, []);

  useEffect(() => {
    if (!vatRateId && vatRates.length > 0) {
      setVatRateId(vatRates.find((r) => r.is_default)?.id || vatRates[0].id);
    }
  }, [vatRates]);

  return (
    <Modal open={open} onClose={onClose} title="Create Ad-hoc Invoice">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ invoice_number: invoiceNumber, customer_id: customerId, invoice_date: invoiceDate, vat_rate_id: vatRateId }); }} className="space-y-4">
        <FormField label="Invoice Number" required>
          <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClasses} required placeholder="e.g. INV-ADHOC-001" />
        </FormField>
        <FormField label="Customer" required>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectClasses} required>
            <option value="">— Select customer —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.customer_unique_id} — {c.company_name}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Invoice Date" required>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputClasses} required />
        </FormField>
        <FormField label="VAT Rate" required>
          <select value={vatRateId} onChange={(e) => setVatRateId(e.target.value)} className={selectClasses} required>
            <option value="">— Select VAT rate —</option>
            {vatRates.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({Number(r.rate).toFixed(2)}%)</option>
            ))}
          </select>
        </FormField>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create Invoice</Button>
        </div>
      </form>
    </Modal>
  );
}
