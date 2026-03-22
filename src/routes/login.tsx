import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { Button } from "~/components/ui/Button";
import { FormField, inputClasses } from "~/components/forms/FormField";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setError("Please enter your email and password");
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Country Fresh Pullets" className="h-14 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Pullet Sales</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <FormField label="Email" required>
              <input
                type="email"
                name="email"
                className={inputClasses}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </FormField>

            <FormField label="Password" required>
              <input
                type="password"
                name="password"
                className={inputClasses}
                placeholder="Enter your password"
                required
              />
            </FormField>

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot your password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
