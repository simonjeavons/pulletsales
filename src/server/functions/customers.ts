import { createServerFn } from "@tanstack/react-start";
import { customerSchema, deliveryAddressSchema } from "~/lib/validation/schemas";
import * as authService from "~/server/services/auth.service";
import * as customersService from "~/server/services/customers.service";
import { getRequest } from "@tanstack/react-start/server";
import type { ListFilters } from "~/types/database";

const requireAdmin = async () => {
  const request = getRequest();
  return authService.requireAdmin(request);
};

// ─── Customers ───────────────────────────────────────────
export const listCustomersFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters & { rep_id?: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.listCustomers(data);
  });

export const getCustomerFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.getCustomer(data.id);
  });

export const createCustomerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => customerSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.createCustomer({
      customer_unique_id: data.customer_unique_id,
      company_name: data.company_name,
      address_line_1: data.address_line_1 || null,
      address_line_2: data.address_line_2 || null,
      town_city: data.town_city || null,
      post_code: data.post_code || null,
      rep_id: data.rep_id || null,
      is_active: data.is_active,
    });
  });

export const updateCustomerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    customerSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.updateCustomer(data.id, data.updates);
  });

export const toggleCustomerActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.toggleCustomerActive(data.id, data.is_active);
  });

// ─── Delivery Addresses ──────────────────────────────────
export const listDeliveryAddressesFn = createServerFn({ method: "GET" })
  .inputValidator((data: { customerId: string }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.listDeliveryAddresses(data.customerId);
  });

export const createDeliveryAddressFn = createServerFn({ method: "POST" })
  .inputValidator((data: { customerId: string; input: unknown }) => {
    const parsed = deliveryAddressSchema.parse(data.input);
    return { customerId: data.customerId, input: parsed };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.createDeliveryAddress(data.customerId, {
      label: data.input.label,
      address_line_1: data.input.address_line_1 || null,
      address_line_2: data.input.address_line_2 || null,
      town_city: data.input.town_city || null,
      post_code: data.input.post_code || null,
      delivery_notes: data.input.delivery_notes || null,
      is_active: data.input.is_active,
      customer_id: data.customerId,
    });
  });

export const updateDeliveryAddressFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; updates: Record<string, unknown> }) => {
    deliveryAddressSchema.partial().parse(data.updates);
    return data;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.updateDeliveryAddress(data.id, data.updates);
  });

export const toggleDeliveryAddressActiveFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; is_active: boolean }) => data)
  .handler(async ({ data }) => {
    await requireAdmin();
    return customersService.toggleDeliveryAddressActive(data.id, data.is_active);
  });
