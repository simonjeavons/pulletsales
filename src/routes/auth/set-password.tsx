import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses } from "~/components/forms/FormField";

export const Route = createFileRoute("/auth/set-password")({
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // On mount, detect the hash token from the invite/reset link and exchange it for a session
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Supabase client auto-detects hash fragments and exchanges them
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSessionReady(true);
        setInitializing(false);
      }
    });

    // Also check if there's already a session (e.g. token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      }
      setInitializing(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!sessionReady) {
      setError("Auth session not ready. Please try clicking the link in your email again.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => navigate({ to: "/login" }), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Country Fresh Pullets" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Pullet Sales</h1>
          <p className="text-gray-500 mt-1 text-sm">Welcome — set your password to get started</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Password set!</h2>
              <p className="text-sm text-gray-600">Redirecting you to login...</p>
            </div>
          ) : initializing ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-gray-500">Setting up your session...</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Link expired or invalid</h2>
              <p className="text-sm text-gray-600">
                This invite link may have expired or already been used. Please ask your administrator to resend the invite.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <FormField label="Password" required>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClasses}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  autoFocus
                />
              </FormField>

              <FormField label="Confirm Password" required>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClasses}
                  placeholder="Re-enter your password"
                  required
                />
              </FormField>

              <Button type="submit" loading={loading} className="w-full">
                Set password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
