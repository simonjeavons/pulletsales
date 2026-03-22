import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ prefixed) for server-side use
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      tanstackStart(),
      viteReact(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "~": new URL("./src", import.meta.url).pathname,
      },
    },
    define: {
      // Make server-only env vars available via process.env at build time
      "process.env.SUPABASE_SERVICE_ROLE_KEY": JSON.stringify(env.SUPABASE_SERVICE_ROLE_KEY || ""),
      "process.env.RESEND_API_KEY": JSON.stringify(env.RESEND_API_KEY || ""),
      "process.env.EMAIL_FROM": JSON.stringify(env.EMAIL_FROM || ""),
    },
  };
});
