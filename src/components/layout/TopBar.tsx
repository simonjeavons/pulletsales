import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import type { Profile } from "~/types/database";
import { Badge } from "~/components/ui/Badge";

interface TopBarProps {
  user: Profile;
}

export function TopBar({ user }: TopBarProps) {
  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
          <Badge variant={user.role === "admin" ? "warning" : "neutral"}>
            {user.role === "admin" ? "Admin" : "User"}
          </Badge>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
