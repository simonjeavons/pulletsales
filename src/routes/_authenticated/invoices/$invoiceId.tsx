import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInvoiceFn,
  saveInvoiceLinesFn,
  finaliseInvoiceFn,
  getInvoicePdfDataFn,
} from "~/server/functions/invoices";
import { pdf } from "@react-pdf/renderer";
import { InvoicePdf } from "~/lib/pdf/InvoicePdf";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { Badge } from "~/components/ui/Badge";
import { FormField, inputClasses } from "~/components/forms/FormField";
import type { InvoiceStatus } from "~/types/database";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
});

const statusColors: Record<InvoiceStatus, "success" | "warning" | "info" | "neutral" | "danger"> = {
  draft: "neutral",
  finalised: "info",
  exported: "success",
  void: "danger",
};

interface LineEntry {
  description: string;
  quantity: string;
  unit_price: string;
  vat_rate: string;
}

const emptyLine = (): LineEntry => ({
  description: "",
  quantity: "1",
  unit_price: "0.00",
  vat_rate: "0",
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoiceFn({ data: { id: invoiceId } }),
  });

  const [lines, setLines] = useState<LineEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (invoice && !initialized) {
      if (invoice.lines && invoice.lines.length > 0) {
        setLines(
          invoice.lines.map((l: any) => ({
            description: l.description,
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
            vat_rate: String(l.vat_rate),
          }))
        );
      } else {
        setLines([emptyLine()]);
      }
      setInitialized(true);
    }
  }, [invoice, initialized]);

  const saveLinesMut = useMutation({
    mutationFn: saveInvoiceLinesFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const finaliseMut = useMutation({
    mutationFn: finaliseInvoiceFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const updateLine = (idx: number, field: keyof LineEntry, value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveLines = () => {
    const validLines = lines.filter((l) => l.description.trim());
    saveLinesMut.mutate({
      data: {
        invoiceId,
        lines: validLines.map((l) => ({
          description: l.description,
          quantity: parseFloat(l.quantity || "1"),
          unit_price: parseFloat(l.unit_price || "0"),
          vat_rate: parseFloat(l.vat_rate || "0"),
        })),
      },
    });
  };

  const handlePrintPdf = async () => {
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

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isDraft = invoice.status === "draft";
  const netTotal = lines.reduce((s, l) => s + parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0"), 0);
  const vatTotal = lines.reduce((s, l) => {
    const net = parseFloat(l.quantity || "0") * parseFloat(l.unit_price || "0");
    return s + net * (parseFloat(l.vat_rate || "0") / 100);
  }, 0);

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`${(invoice as any).customer?.company_name || "Ad-hoc"} ${(invoice as any).order ? `— Order ${(invoice as any).order.order_number}` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={statusColors[invoice.status as InvoiceStatus]}>
              {invoice.status}
            </Badge>
            {invoice.exported_at && <Badge variant="success">Exported</Badge>}
            <Button variant="secondary" size="sm" onClick={handlePrintPdf}>
              📄 Print Invoice
            </Button>
            {isDraft && (
              <Button size="sm" onClick={() => finaliseMut.mutate({ data: { id: invoiceId } })} loading={finaliseMut.isPending}>
                Finalise
              </Button>
            )}
          </div>
        }
      />

      {/* Invoice Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-4xl">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block">Invoice Number</span>
            <span className="font-medium">{invoice.invoice_number}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Date</span>
            <span className="font-medium">{new Date(invoice.invoice_date).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Customer</span>
            <span className="font-medium">{(invoice as any).customer?.company_name || "—"}</span>
          </div>
          <div>
            <span className="text-gray-500 block">VAT Rate</span>
            <span className="font-medium">{(invoice as any).vat_rate ? `${(invoice as any).vat_rate.name} (${Number((invoice as any).vat_rate.rate).toFixed(2)}%)` : "—"}</span>
          </div>
        </div>
      </div>

      {/* Invoice Lines */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Invoice Lines</h3>
          {isDraft && (
            <Button type="button" variant="secondary" size="sm" onClick={addLine}>
              + Add Line
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5">
                <FormField label={idx === 0 ? "Description" : ""}>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    className={inputClasses}
                    placeholder="e.g. 2000 Bovans Brown, Commission, etc."
                    disabled={!isDraft}
                  />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label={idx === 0 ? "Quantity" : ""}>
                  <input
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    className={inputClasses}
                    disabled={!isDraft}
                  />
                </FormField>
              </div>
              <div className="col-span-2">
                <FormField label={idx === 0 ? "Unit Price (£)" : ""}>
                  <input
                    type="number"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                    className={inputClasses}
                    disabled={!isDraft}
                  />
                </FormField>
              </div>
              <div className="col-span-1">
                <FormField label={idx === 0 ? "VAT %" : ""}>
                  <input
                    type="number"
                    step="0.01"
                    value={line.vat_rate}
                    onChange={(e) => updateLine(idx, "vat_rate", e.target.value)}
                    className={inputClasses}
                    disabled={!isDraft}
                  />
                </FormField>
              </div>
              <div className="col-span-1">
                {idx === 0 && <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>}
                <div className="px-3 py-2 text-sm bg-gray-100 rounded-lg font-medium">
                  £{(parseFloat(line.quantity || "0") * parseFloat(line.unit_price || "0")).toFixed(2)}
                </div>
              </div>
              <div className="col-span-1">
                {isDraft && lines.length > 1 && (
                  <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 text-sm px-2 py-2">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 mt-6 pt-4">
          <div className="flex justify-end space-y-1">
            <div className="w-60 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Net Total</span>
                <span className="font-medium">£{netTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT</span>
                <span className="font-medium">£{vatTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-2">
                <span>Total</span>
                <span>£{(netTotal + vatTotal).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {isDraft && (
          <div className="mt-4">
            <Button onClick={handleSaveLines} loading={saveLinesMut.isPending}>
              Save Lines
            </Button>
          </div>
        )}
      </div>

      <Link to="/invoices" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
        ← Back to Invoices
      </Link>
    </div>
  );
}
