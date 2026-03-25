import { createFileRoute, Link } from "@tanstack/react-router";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");

  const { data, isLoading } = useQuery({
    queryKey: ["orders", search, statusFilter],
    queryFn: () =>
      listOrdersFn({
        data: {
          search: search || undefined,
          status: statusFilter || undefined,
        },
      }),
  });

  const columns = [
    {
      key: "order_number",
      header: "Order #",
      render: (o: any) => (
        <Link
          to={`/orders/${o.id}`}
          className="font-medium text-blue-600 hover:text-blue-800"
        >
          {o.order_number}
        </Link>
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
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (o: any) => (
        <Link to={`/orders/${o.id}`}>
          <Button variant="ghost" size="sm">
            View
          </Button>
        </Link>
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

      <div className="flex gap-3 mb-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by order number or customer..."
          className="w-80"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        keyExtractor={(o: any) => o.id}
        loading={isLoading}
        emptyMessage="No orders found."
      />
    </div>
  );
}
