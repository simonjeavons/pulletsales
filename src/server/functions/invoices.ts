import { createServerFn } from "@tanstack/react-start";
import * as invoicesService from "~/server/services/invoices.service";
import type { InvoiceStatus, ListFilters } from "~/types/database";

export const listInvoicesFn = createServerFn({ method: "GET" })
  .inputValidator((data: ListFilters & { status?: InvoiceStatus; customer_id?: string }) => data)
  .handler(async ({ data }) => {
    return invoicesService.listInvoices(data);
  });

export const createInvoiceFn = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    return invoicesService.createInvoice(data.orderId);
  });

export const finaliseInvoiceFn = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    return invoicesService.finaliseInvoice(data.id);
  });

export const exportInvoicesFn = createServerFn({ method: "POST" })
  .inputValidator((data: { invoiceIds: string[]; exportedBy?: string }) => data)
  .handler(async ({ data }) => {
    return invoicesService.exportInvoices(data.invoiceIds, data.exportedBy);
  });

export const generateInvoiceCsvFn = createServerFn({ method: "POST" })
  .inputValidator((data: { invoiceIds: string[] }) => data)
  .handler(async ({ data }) => {
    return invoicesService.generateInvoiceCsvData(data.invoiceIds);
  });

export const getInvoicePdfDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: { invoiceId: string }) => data)
  .handler(async ({ data }) => {
    return invoicesService.getInvoicePdfData(data.invoiceId);
  });
