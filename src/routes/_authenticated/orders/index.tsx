import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listOrdersFn } from "~/server/functions/orders";
import { PageHeader } from "~/components/ui/PageHeader";
import { Button } from "~/components/ui/Button";
import { DataTable } from "~/components/ui/DataTable";
import { SearchBar } from "~/components/ui/SearchBar";
import { Badge } from "~/components/ui/Badge";
import type { OrderStatus } from "~/types/database";

export const Route = createFileRoute("/_authenticated/orders/")({
  component: OrdersListPage,
});

const statusColors: Record<OrderStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  draft: "neutral",
  confirmed: "info",
  pending_despatch: "warning",
  ready_for_despatch: "warning",
  completed: "success",
  cancelled: "danger",
  invoiced: "success",
};

const statusLabels: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  pending_despatch: "Pending Despatch",
  ready_for_despatch: "Ready for Despatch",
  completed: "Completed",
  cancelled: "Cancelled",
  invoiced: "Invoiced",
};

function OrdersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "active" | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", search, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      listOrdersFn({
        data: {
          search: search || undefined,
          status: statusFilter === "active" ? undefined : statusFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      }),
  });

  // Filter out cancelled on the client when "Active" is selected
  const filteredData = statusFilter === "active"
    ? (data?.data ?? []).filter((o: any) => o.status !== "cancelled")
    : (data?.data ?? []);

  const columns = [
    {
      key: "order_number",
      header: "Order #",
      render: (o: any) => (
        <span className="font-medium text-gray-900">{o.order_number}</span>
      ),
    },
    {
      key: "created",
      header: "Order Date",
      render: (o: any) => new Date(o.created_at).toLocaleDateString(),
    },
    {
      key: "customer",
      header: "Customer",
      render: (o: any) => o.customer?.company_name || "—",
    },
    {
      key: "wc_date",
      header: "Requested W/C",
      render: (o: any) =>
        o.requested_delivery_week_commencing
          ? new Date(o.requested_delivery_week_commencing).toLocaleDateString()
          : "—",
    },
    {
      key: "rep",
      header: "Rep",
      render: (o: any) => o.rep?.name || "—",
    },
    {
      key: "qty",
      header: "Qty",
      className: "text-right",
      render: (o: any) => {
        const qty = (o.order_lines ?? []).reduce((s: number, l: any) => s + (l.quantity || 0), 0);
        return qty > 0 ? qty.toLocaleString() : "—";
      },
    },
    {
      key: "value",
      header: "Value",
      className: "text-right",
      render: (o: any) => {
        const total = (o.order_lines ?? []).reduce(
          (s: number, l: any) => s + (l.quantity || 0) * (Number(l.price) || 0),
          0
        );
        return total > 0
          ? `£${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—";
      },
    },
    {
      key: "status",
      header: "Status",
      render: (o: any) => (
        <Badge variant={statusColors[o.status as OrderStatus] || "neutral"}>
          {statusLabels[o.status as OrderStatus] || o.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage pullet sales orders."
        actions={
          <Link to="/orders/new">
            <Button>New Order</Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by order number or customer..."
          className="w-80"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "active" | "")}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active (excl. Cancelled)</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 uppercase">W/C From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 uppercase">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear dates
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(o: any) => o.id}
        loading={isLoading}
        emptyMessage="No orders found."
        onRowClick={(o: any) => navigate({ to: `/orders/${o.id}` })}
      />
    </div>
  );
}
