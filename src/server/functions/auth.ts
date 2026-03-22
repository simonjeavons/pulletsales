import { createServerFn } from "@tanstack/react-start";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import { getRequest } from "@tanstack/react-start/server";

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const result = await authService.signIn(request, data.email, data.password);
    if (result.error) {
      throw new Error(result.error);
    }
    return { success: true };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const request = getRequest();
  await authService.signOut(request);
  return { success: true };
});

export const forgotPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => forgotPasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const result = await authService.requestPasswordReset(request, data.email);
    // Always return success to prevent email enumeration
    return { success: true };
  });

export const resetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => resetPasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    const result = await authService.updatePassword(request, data.password);
    if (result.error) {
      throw new Error(result.error);
    }
    return { success: true };
  });

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const profile = await authService.getCurrentUser(request);
    return { user: profile };
  }
);
