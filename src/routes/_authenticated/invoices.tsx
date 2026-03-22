import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Modal, ConfirmModal } from "~/components/ui/Modal";
import type { InvoiceStatus, InvoiceWithRelations } from "~/types/database";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportConfirm, setExportConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search, statusFilter],
    queryFn: () =>
      listInvoicesFn({
        data: {
          search: search || undefined,
          status: statusFilter || undefined,
        },
      }),
  });

  // Completed orders eligible for invoicing
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

  const finaliseMut = useMutation({
    mutationFn: finaliseInvoiceFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const exportMut = useMutation({
    mutationFn: exportInvoicesFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds([]);
      setExportConfirm(false);
    },
  });

  const handleExportCsv = async () => {
    const csvData = await generateInvoiceCsvFn({ data: { invoiceIds: selectedIds } });
    if (!csvData || csvData.length === 0) return;

    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row: any) =>
        headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Mark as exported
    exportMut.mutate({ data: { invoiceIds: selectedIds } });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const columns = [
    {
      key: "select",
      header: "",
      render: (inv: InvoiceWithRelations) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(inv.id)}
          onChange={() => toggleSelect(inv.id)}
          className="h-4 w-4 rounded border-gray-300"
        />
      ),
    },
    {
      key: "number",
      header: "Invoice #",
      render: (inv: InvoiceWithRelations) => (
        <span className="font-medium">{inv.invoice_number}</span>
      ),
    },
    {
      key: "order",
      header: "Order",
      render: (inv: any) => inv.order?.order_number || "—",
    },
    {
      key: "customer",
      header: "Customer",
      render: (inv: any) => inv.customer?.company_name || "—",
    },
    {
      key: "date",
      header: "Date",
      render: (inv: InvoiceWithRelations) =>
        new Date(inv.invoice_date).toLocaleDateString(),
    },
    {
      key: "status",
      header: "Status",
      render: (inv: InvoiceWithRelations) => (
        <Badge variant={statusColors[inv.status]}>{inv.status}</Badge>
      ),
    },
    {
      key: "exported",
      header: "Exported",
      render: (inv: InvoiceWithRelations) =>
        inv.exported_at ? (
          <Badge variant="success">Yes</Badge>
        ) : (
          <Badge variant="neutral">No</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (inv: InvoiceWithRelations) => (
        <div className="flex justify-end gap-2">
          {inv.status === "draft" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => finaliseMut.mutate({ data: { id: inv.id } })}
            >
              Finalise
            </Button>
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
            <Button onClick={() => setShowCreateModal(true)}>
              Create Invoice
            </Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by invoice number..."
          className="w-80"
        />
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
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(inv: any) => inv.id}
        loading={isLoading}
        emptyMessage="No invoices found."
      />

      {/* Create Invoice Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Invoice from Completed Order"
      >
        <div className="space-y-3">
          {(completedOrders?.data ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">
              No completed orders available for invoicing.
            </p>
          ) : (
            (completedOrders?.data ?? []).map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between border border-gray-200 rounded-lg p-3"
              >
                <div>
                  <span className="font-medium">{order.order_number}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {order.customer?.company_name}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => createMut.mutate({ data: { orderId: order.id } })}
                  loading={createMut.isPending}
                >
                  Create Invoice
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
