import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import type { Profile } from "~/types/database";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single();
        if (data) setUser(data as Profile);
      }
    }
    loadUser();
  }, []);

  if (!user) return null;

  const adminCards = [
    { label: "Users", to: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197", color: "bg-blue-500" },
    { label: "Reps", to: "/admin/reps", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "bg-emerald-500" },
    { label: "Customers", to: "/admin/customers", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "bg-violet-500" },
    { label: "Extras", to: "/admin/extras", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", color: "bg-amber-500" },
    { label: "Breeds", to: "/admin/breeds", icon: "M4 6h16M4 10h16M4 14h16M4 18h16", color: "bg-rose-500" },
    { label: "Rearers", to: "/admin/rearers", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", color: "bg-orange-500" },
    { label: "Transporters", to: "/admin/transporters", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0", color: "bg-cyan-500" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user.full_name}
        </h1>
        <p className="text-gray-500 mt-1">
          Lloyds Pullet Sales Order System — Phase 1: Admin Setup
        </p>
      </div>

      {user.role === "admin" && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Admin Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminCards.map((card) => (
              <a
                key={card.to}
                href={card.to}
                className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{card.label}</h3>
                  <p className="text-sm text-gray-500">Manage {card.label.toLowerCase()}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {user.role === "standard_user" && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h2 className="text-lg font-semibold text-gray-800">Welcome</h2>
          <p className="text-gray-500 mt-2">
            Operational modules will be available in Phase 2.
          </p>
        </div>
      )}
    </div>
  );
}
