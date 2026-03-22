import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import type { Profile, OrderStatus } from "~/types/database";
import { Badge } from "~/components/ui/Badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface DashboardData {
  user: Profile | null;
  ordersByStatus: Record<string, { count: number; value: number }>;
  ordersByMonth: Array<{ month: string; count: number; value: number }>;
  topReps: Array<{ name: string; count: number; value: number }>;
  topCustomers: Array<{ name: string; count: number; value: number }>;
  topBreeds: Array<{ name: string; count: number; qty: number }>;
  recentOrders: any[];
  totalActiveCustomers: number;
  totalActiveBreeds: number;
  pendingInvoices: number;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  pending_despatch: "Pending Despatch",
  ready_for_despatch: "Ready for Despatch",
  completed: "Completed",
  cancelled: "Cancelled",
  invoiced: "Invoiced",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-blue-100 text-blue-700",
  pending_despatch: "bg-yellow-100 text-yellow-700",
  ready_for_despatch: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  invoiced: "bg-emerald-100 text-emerald-700",
};

function DashboardPage() {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from("profiles").select("*").eq("auth_user_id", session.user.id).single();

      // Orders by status
      const { data: orders } = await supabase.from("orders").select("id, status, customer_id, rep_id, created_at, requested_delivery_week_commencing");
      const { data: orderLines } = await supabase.from("order_lines").select("order_id, quantity, price, rearer_id");

      // Build order value map
      const orderValueMap: Record<string, number> = {};
      (orderLines ?? []).forEach((line) => {
        orderValueMap[line.order_id] = (orderValueMap[line.order_id] || 0) + (line.quantity * Number(line.price));
      });

      // Orders by status
      const byStatus: Record<string, { count: number; value: number }> = {};
      (orders ?? []).forEach((o) => {
        if (!byStatus[o.status]) byStatus[o.status] = { count: 0, value: 0 };
        byStatus[o.status].count++;
        byStatus[o.status].value += orderValueMap[o.id] || 0;
      });

      // Orders by month (based on requested delivery W/C)
      const byMonth: Record<string, { count: number; value: number }> = {};
      (orders ?? []).filter((o) => o.requested_delivery_week_commencing).forEach((o) => {
        const d = new Date(o.requested_delivery_week_commencing);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[key]) byMonth[key] = { count: 0, value: 0 };
        byMonth[key].count++;
        byMonth[key].value += orderValueMap[o.id] || 0;
      });
      const ordersByMonth = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({ month, ...data }));

      // Top reps
      const repCounts: Record<string, { count: number; value: number }> = {};
      (orders ?? []).filter((o) => o.rep_id).forEach((o) => {
        if (!repCounts[o.rep_id]) repCounts[o.rep_id] = { count: 0, value: 0 };
        repCounts[o.rep_id].count++;
        repCounts[o.rep_id].value += orderValueMap[o.id] || 0;
      });
      const { data: reps } = await supabase.from("reps").select("id, name");
      const repMap = Object.fromEntries((reps ?? []).map((r) => [r.id, r.name]));
      const topReps = Object.entries(repCounts)
        .map(([id, d]) => ({ name: repMap[id] || "Unknown", ...d }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Top customers
      const custCounts: Record<string, { count: number; value: number }> = {};
      (orders ?? []).forEach((o) => {
        if (!custCounts[o.customer_id]) custCounts[o.customer_id] = { count: 0, value: 0 };
        custCounts[o.customer_id].count++;
        custCounts[o.customer_id].value += orderValueMap[o.id] || 0;
      });
      const { data: customers } = await supabase.from("customers").select("id, company_name");
      const custMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c.company_name]));
      const topCustomers = Object.entries(custCounts)
        .map(([id, d]) => ({ name: custMap[id] || "Unknown", ...d }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Top breeds
      const breedCounts: Record<string, { count: number; qty: number }> = {};
      (orderLines ?? []).forEach((l: any) => {
        if (!breedCounts[l.breed_id]) breedCounts[l.breed_id] = { count: 0, qty: 0 };
        breedCounts[l.breed_id].count++;
        breedCounts[l.breed_id].qty += l.quantity || 0;
      });
      const { data: breedsList } = await supabase.from("breeds").select("id, breed_name");
      const breedMap = Object.fromEntries((breedsList ?? []).map((b) => [b.id, b.breed_name]));
      const topBreeds = Object.entries(breedCounts)
        .map(([id, d]) => ({ name: breedMap[id] || "Unknown", count: d.count, qty: d.qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // Recent orders
      const { data: recentOrders } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, customer:customers(company_name)")
        .order("created_at", { ascending: false })
        .limit(5);

      // Counts
      const { count: activeCustomers } = await supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true);
      const { count: activeBreeds } = await supabase.from("breeds").select("id", { count: "exact", head: true }).eq("is_available", true);
      const { count: pendingInv } = await supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["draft", "finalised"]);

      setUser(profile as Profile);
      setData({
        user: profile as Profile,
        ordersByStatus: byStatus,
        ordersByMonth,
        topReps,
        topCustomers,
        topBreeds,
        recentOrders: recentOrders ?? [],
        totalActiveCustomers: activeCustomers ?? 0,
        totalActiveBreeds: activeBreeds ?? 0,
        pendingInvoices: pendingInv ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !data || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalOrders = Object.values(data.ordersByStatus).reduce((s, d) => s + d.count, 0);
  const totalValue = Object.values(data.ordersByStatus).reduce((s, d) => s + d.value, 0);
  const activeOrders = ["draft", "confirmed", "pending_despatch", "ready_for_despatch"]
    .reduce((s, st) => s + (data.ordersByStatus[st]?.count || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user.full_name}</h1>
        <p className="text-gray-500 mt-1 text-sm">Here's your overview for today.</p>
      </div>

      {/* ─── Summary Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Orders" value={totalOrders.toString()} sub={`£${totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`} />
        <SummaryCard label="Active Orders" value={activeOrders.toString()} sub="In progress" accent />
        <SummaryCard label="Active Customers" value={data.totalActiveCustomers.toString()} sub={`${data.totalActiveBreeds} breeds available`} />
        <SummaryCard label="Pending Invoices" value={data.pendingInvoices.toString()} sub="Draft or finalised" />
      </div>

      {/* ─── Orders by Status ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {["draft", "confirmed", "pending_despatch", "ready_for_despatch", "completed", "cancelled", "invoiced"].map((status) => {
            const d = data.ordersByStatus[status];
            return (
              <div key={status} className="text-center p-3 rounded-lg border border-gray-100">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${statusColors[status]}`}>
                  {statusLabels[status]}
                </span>
                <p className="text-2xl font-bold text-gray-900">{d?.count || 0}</p>
                <p className="text-xs text-gray-500">£{(d?.value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Orders by Month ──────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Month</h2>
          {data.ordersByMonth.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {data.ordersByMonth.map((m) => {
                const maxVal = Math.max(...data.ordersByMonth.map((x) => x.value));
                const pct = maxVal > 0 ? (m.value / maxVal) * 100 : 0;
                const [y, mo] = m.month.split("-");
                const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                      <div className="bg-brand-500 h-6 rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-16 text-right">{m.count} orders</span>
                    <span className="text-sm text-gray-500 w-24 text-right">£{m.value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Recent Orders ────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/orders" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all →</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((o: any) => (
                <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <span className="font-medium text-gray-900">{o.order_number}</span>
                    <span className="text-gray-500 text-sm ml-2">{o.customer?.company_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status]}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Top Reps ─────────────────────────────────── */}
        <LeaderboardCard title="Top Reps" items={data.topReps} showValue />

        {/* ─── Top Customers ────────────────────────────── */}
        <LeaderboardCard title="Top Customers" items={data.topCustomers} showValue />

        {/* ─── Top Breeds ───────────────────────────────── */}
        <LeaderboardCard title="Top Breeds" items={data.topBreeds.map((b) => ({ ...b, value: b.qty }))} valueLabel="pullets" />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "bg-brand-50 border-brand-200" : "bg-white border-gray-200"}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? "text-brand-700" : "text-gray-900"}`}>{value}</p>
      <p className="text-sm text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function LeaderboardCard({ title, items, showValue, valueLabel }: {
  title: string;
  items: Array<{ name: string; count: number; value?: number }>;
  showValue?: boolean;
  valueLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No data yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">{item.count} {valueLabel || "orders"}</span>
                {showValue && item.value !== undefined && (
                  <span className="text-xs text-gray-400 block">
                    £{item.value.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
