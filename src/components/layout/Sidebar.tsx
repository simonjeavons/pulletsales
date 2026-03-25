import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { Profile } from "~/types/database";

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

const mainItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Orders", to: "/orders", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { label: "Invoices", to: "/invoices", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
];

const adminItems: NavItem[] = [
  // Users — person with badge
  { label: "Users", to: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" },
  // Reps — person with briefcase
  { label: "Reps", to: "/admin/reps", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  // Customers — building/office
  { label: "Customers", to: "/admin/customers", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  // Breeds — feather/bird (egg-like shape with feather)
  { label: "Breeds", to: "/admin/breeds", icon: "M12 3c-1.2 0-2.4.6-3 1.5C8.4 5.4 8 6.6 8 8c0 2 1 3.5 2.5 4.5L9 21h6l-1.5-8.5C15 11.5 16 10 16 8c0-1.4-.4-2.6-1-3.5-.6-.9-1.8-1.5-3-1.5z" },
  // Extras — puzzle piece
  { label: "Extras", to: "/admin/extras", icon: "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" },
  // Rearers — barn/farm
  { label: "Rearers", to: "/admin/rearers", icon: "M3 21h18M3 21V10l9-7 9 7v11M9 21v-6h6v6" },
  // Transporters — truck
  { label: "Transporters", to: "/admin/transporters", icon: "M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" },
  // Trading Companies — briefcase
  { label: "Trading Companies", to: "/admin/trading-companies", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  // VAT Rates — percentage/calculator
  { label: "VAT Rates", to: "/admin/vat-rates", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  // Settings — cog
  { label: "Settings", to: "/admin/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

function isActive(currentPath: string, to: string): boolean {
  if (to === "/dashboard") return currentPath === "/dashboard";
  return currentPath === to || currentPath.startsWith(to + "/");
}

function NavLink({ item, currentPath }: { item: NavItem; currentPath: string }) {
  const active = isActive(currentPath, item.to);
  return (
    <Link
      to={item.to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );
}

export function Sidebar({ user }: { user: Profile }) {
  const router = useRouter();
  const currentPath = router.state.location.pathname;
  const adminOpen = currentPath.startsWith("/admin");
  const [showAdmin, setShowAdmin] = useState(adminOpen);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-5 py-4 border-b border-gray-200">
        <img src="/logo.png" alt="Country Fresh Pullets" className="h-10 w-auto" />
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-1 mb-4">
          {mainItems.map((item) => (
            <NavLink key={item.to} item={item} currentPath={currentPath} />
          ))}
        </div>

        {user.role === "admin" && (
          <div>
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
            >
              <span>Admin</span>
              <svg
                className={`w-4 h-4 transition-transform ${showAdmin ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAdmin && (
              <div className="space-y-1 mt-1">
                {adminItems.map((item) => (
                  <NavLink key={item.to} item={item} currentPath={currentPath} />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-400">
        Lloyds Pullet Sales v1.0
      </div>
    </aside>
  );
}
