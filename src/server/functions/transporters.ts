import { createServerFn } from "@tanstack/react-start";
import { transporterSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as transportersService from "~/server/services/transporters.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

export const listTransportersFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return transportersService.listTransporters(data);
  });

export const getTransporterFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return transportersService.getTransporter(data.id);
  });

export const createTransporterFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => transporterSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return transportersService.createTransporter({
      transporter_name: data.transporter_name,
      address_line_1: data.address_line_1 || null,
      address_line_2: data.address_line_2 || null,
      town_city: data.town_city || null,
      post_code: data.post_code || null,
      phone: data.phone || null,
      email: data.email || null,
      is_active: data.is_active,
    });
  });

export const updateTransporterFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    transporterSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return transportersService.updateTransporter(data.id, data.updates);
  });

export const toggleTransporterActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return transportersService.toggleTransporterActive(data.id, data.is_active);
  });
