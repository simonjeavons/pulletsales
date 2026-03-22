import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import {
  listInvoicesFn,
  finaliseInvoiceFn,
  exportInvoicesFn,
  generateInvoiceCsvFn,
  getInvoicePdfDataFn,
} from "~/server/functions/invoices";
import { listOrdersFn } from "~/server/functions/orders";
import { createInvoiceFn } from "~/server/functions/invoices";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdf } from "~/lib/pdf/InvoicePdf";
import { ExportConfirmationPdf } from "~/lib/pdf/ExportConfirmationPdf";
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

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCsvData, setExportCsvData] = useState<any[] | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleStartExport = async () => {
    setExportLoading(true);
    const csvData = await generateInvoiceCsvFn({ data: { invoiceIds: selectedIds } });
    setExportCsvData(csvData);
    setExportLoading(false);
    setShowExportModal(true);
  };

  const downloadCsv = () => {
    if (!exportCsvData || exportCsvData.length === 0) return;
    const cols = ["type", "customer_ref", "nominal", "depot", "invoice_date", "invoice_number", "details", "grand_total", "vat_code", "tax_amount"];
    const csvContent = exportCsvData.map((row: any) =>
      cols.map((c) => String(row[c] ?? "")).join(",")
    ).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExportPdf = async () => {
    if (!exportCsvData || exportCsvData.length === 0) return;
    const rows = exportCsvData.map((row: any) => ({
      invoiceNumber: row.invoice_number,
      tradingCo: "CFP",
      type: row.type,
      account: row.customer_ref,
      nominal: row.nominal,
      dept: row.depot,
      date: row.invoice_date,
      ref: row.invoice_number,
      details: row.details,
      net: `£${Number(row.grand_total).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
      taxCode: row.vat_code,
      taxAmount: `£${Number(row.tax_amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`,
    }));
    const blob = await pdf(<ExportConfirmationPdf rows={rows} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TAS_Export_Confirmation_${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmExport = () => {
    downloadCsv();
    exportMut.mutate({ data: { invoiceIds: selectedIds } });
    setShowExportModal(false);
    setExportCsvData(null);
  };

  const handlePrintInvoicePdf = async (invoiceId: string) => {
    try {
      const pdfData = await getInvoicePdfDataFn({ data: { invoiceId } });
      const blob = await pdf(<InvoicePdf data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice_${pdfData.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice PDF failed:", err);
    }
  };

  const handlePrintSelectedInvoices = async () => {
    for (const id of selectedIds) {
      await handlePrintInvoicePdf(id);
    }
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
          <Button variant="ghost" size="sm" onClick={() => handlePrintInvoicePdf(inv.id)}>📄</Button>
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
              <>
                <Button variant="secondary" onClick={handlePrintSelectedInvoices}>
                  📄 Print {selectedIds.length} Invoice(s)
                </Button>
                <Button variant="secondary" onClick={handleStartExport} loading={exportLoading}>
                  Export {selectedIds.length} to TAS
                </Button>
              </>
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

      {/* Export Modal */}
      <Modal open={showExportModal} onClose={() => { setShowExportModal(false); setExportCsvData(null); }} title="Export to TAS" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {selectedIds.length} invoice(s) ready for export. Download the CSV file for TAS import and/or the confirmation report.
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={downloadCsv} className="flex-1">
              📥 Download CSV
            </Button>
            <Button variant="secondary" onClick={downloadExportPdf} className="flex-1">
              📄 Export Confirmation PDF
            </Button>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 mb-3">
              Click "Confirm Export" to mark these invoices as exported. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { setShowExportModal(false); setExportCsvData(null); }}>
                Cancel
              </Button>
              <Button onClick={confirmExport} loading={exportMut.isPending}>
                Confirm Export
              </Button>
            </div>
          </div>
        </div>
      </Modal>
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
