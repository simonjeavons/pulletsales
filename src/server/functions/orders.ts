import { createServerFn } from "@tanstack/react-start";
import { orderSchema } from "~/lib/validation/schemas";
import * as ordersService from "~/server/services/orders.service";
import type { OrderListFilters, OrderStatus } from "~/types/database";

export const listOrdersFn = createServerFn({ method: "GET" })
  .inputValidator((data: OrderListFilters) => data)
  .handler(async ({ data }) => {
    return ordersService.listOrders(data);
  });

export const getOrderFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return ordersService.getOrder(data.id);
  });

export const createOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { order: unknown; createdBy?: string }) => {
    const parsed = orderSchema.parse(data.order);
    return { order: parsed, createdBy: data.createdBy };
  })
  .handler(async ({ data }) => {
    return ordersService.createOrder(data.order, data.createdBy);
  });

export const updateOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; order: unknown }) => {
    const parsed = orderSchema.parse(data.order);
    return { id: data.id, order: parsed };
  })
  .handler(async ({ data }) => {
    return ordersService.updateOrder(data.id, data.order);
  });

export const transitionOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: OrderStatus }) => data)
  .handler(async ({ data }) => {
    return ordersService.transitionOrder(data.id, data.status);
  });
