"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { InvoiceSummaryData } from "@/components/admin/invoice-summary";
import { Button } from "@/components/ui/button";
import { CheckboxInput } from "@/components/ui/checkbox-input";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioInput } from "@/components/ui/radio-input";
import { SelectInput, SelectInputOption } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { ApiClientError } from "@/lib/api-client";
import { useAdminCustomerOptionsQuery } from "@/lib/hooks/use-admin-customers";
import {
  AdminInvoiceRecord,
  InvoicePaymentType,
  InvoicePayload,
  useAdminNextInvoiceNoQuery,
  useCreateAdminInvoiceMutation,
  useUpdateAdminInvoiceMutation,
} from "@/lib/hooks/use-admin-invoices";
import { AdminProductPriceRecord, useAdminActiveProductPriceOptionsQuery } from "@/lib/hooks/use-admin-product-prices";

type InvoiceFormState = {
  invoice_no: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_no: string;
  payment_type: InvoicePaymentType;
  discount_amount: string;
};

type InvoiceItemFormState = {
  id: string;
  product_price_id: string;
  quantity: string;
  line_total: string;
};

const mobilePattern = /^[0-9+\-\s()]+$/;

function getCurrentDateLocal() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  return now.toISOString().slice(0, 10);
}

function generateInvoiceNo() {
  return "";
}

function createEmptyForm(): InvoiceFormState {
  return {
    invoice_no: generateInvoiceNo(),
    invoice_date: getCurrentDateLocal(),
    customer_id: "",
    customer_name: "",
    customer_mobile: "",
    vehicle_no: "",
    payment_type: "cash",
    discount_amount: "0",
  };
}

function createEmptyItem(): InvoiceItemFormState {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    product_price_id: "",
    quantity: "1",
    line_total: "",
  };
}

function createFormFromInvoice(invoice: AdminInvoiceRecord): InvoiceFormState {
  const invoiceDate = invoice.invoice_datetime ? new Date(invoice.invoice_datetime).toISOString().slice(0, 10) : getCurrentDateLocal();

  return {
    invoice_no: invoice.invoice_no,
    invoice_date: invoiceDate,
    customer_id: invoice.customer ? String(invoice.customer.id) : "",
    customer_name: invoice.customer?.name ?? "",
    customer_mobile: invoice.customer?.mobile ?? "",
    vehicle_no: invoice.customer?.vehicle_no ?? "",
    payment_type: invoice.payment_type,
    discount_amount: invoice.discount_amount ?? "0",
  };
}

function createItemsFromInvoice(invoice: AdminInvoiceRecord): InvoiceItemFormState[] {
  const invoiceItems = invoice.items
    .filter((item) => item.product_id && item.product_price_id)
    .map((item) => ({
      id: `invoice-item-${item.id}`,
      product_price_id: String(item.product_price_id),
      quantity: item.quantity,
      line_total: item.line_total,
    }));

  return invoiceItems.length > 0 ? invoiceItems : [createEmptyItem()];
}

function buildInvoiceDateTime(date: string, fallbackDateTime?: string | null) {
  const sourceDate = fallbackDateTime ? new Date(fallbackDateTime) : new Date();
  const hours = String(sourceDate.getHours()).padStart(2, "0");
  const minutes = String(sourceDate.getMinutes()).padStart(2, "0");

  return `${date}T${hours}:${minutes}`;
}

function toNumber(value: string) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatCalculatedAmount(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "";
}

function formatCalculatedQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toFixed(2);
}

function normalizeLookupValue(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function getPriceLabel(price: AdminProductPriceRecord) {
  const productName = price.product?.product_name ?? "Deleted product";
  const productCode = price.product?.product_code ? ` (${price.product.product_code})` : "";
  const unitName = price.unit ? ` - ${price.unit.unit_name}` : "";

  return `${productName}${productCode}${unitName} - BDT ${price.sell_price}`;
}

type InvoiceFormPageProps = {
  invoice?: AdminInvoiceRecord;
};

export function InvoiceFormPage({ invoice }: InvoiceFormPageProps) {
  const router = useRouter();
  const { data: productPrices = [], isLoading: isPricesLoading } = useAdminActiveProductPriceOptionsQuery(true);
  const createInvoice = useCreateAdminInvoiceMutation();
  const updateInvoice = useUpdateAdminInvoiceMutation();
  const isEditing = Boolean(invoice);
  const [form, setForm] = useState<InvoiceFormState>(() => (invoice ? createFormFromInvoice(invoice) : createEmptyForm()));
  const [items, setItems] = useState<InvoiceItemFormState[]>(() => (invoice ? createItemsFromInvoice(invoice) : [createEmptyItem()]));
  const [formError, setFormError] = useState<string | null>(null);
  const [isDiscountInputOpen, setIsDiscountInputOpen] = useState(false);
  const [discountDraft, setDiscountDraft] = useState("0");
  const [pendingCreatePayload, setPendingCreatePayload] = useState<InvoicePayload | null>(null);
  const [shouldSendSms, setShouldSendSms] = useState(false);
  const isSubmitting = createInvoice.isPending || updateInvoice.isPending;
  const customerLookupTerm = useMemo(() => form.customer_mobile.trim() || form.vehicle_no.trim(), [form.customer_mobile, form.vehicle_no]);
  const { data: customerMatches = [] } = useAdminCustomerOptionsQuery(customerLookupTerm, customerLookupTerm.length >= 2);
  const { data: nextInvoiceNo, isLoading: isInvoiceNoLoading } = useAdminNextInvoiceNoQuery(form.invoice_date, !isEditing && Boolean(form.invoice_date));
  const invoiceNo = isEditing ? form.invoice_no : (nextInvoiceNo?.invoice_no ?? form.invoice_no);
  const isFormBusy = isSubmitting || isPricesLoading || isInvoiceNoLoading;

  const productPriceOptions = useMemo(() => {
    const options = [...productPrices];
    const existingIds = new Set(options.map((price) => String(price.id)));

    invoice?.items.forEach((item) => {
      if (!item.product_id || !item.product_price_id || existingIds.has(String(item.product_price_id))) {
        return;
      }

      options.push({
        id: item.product_price_id,
        product_id: item.product_id,
        product: {
          id: item.product_id,
          product_name: item.product_name,
          product_code: null,
          status: "active",
        },
        product_unit_id: item.product_unit_id,
        unit: item.product_unit_id
          ? {
              id: item.product_unit_id,
              unit_name: item.unit_name ?? "Unit",
              unit_value: item.unit_value ?? "1",
              unit_code: item.unit_code ?? "",
            }
          : null,
        original_price: item.price,
        sell_price: item.price,
        date_time: invoice.invoice_datetime,
        is_active: true,
        created_by: null,
        creator: null,
        deactivated_at: null,
        note: null,
        created_at: null,
        updated_at: null,
      });
      existingIds.add(String(item.product_price_id));
    });

    return options;
  }, [invoice, productPrices]);

  const priceById = useMemo(() => {
    return new Map(productPriceOptions.map((price) => [String(price.id), price]));
  }, [productPriceOptions]);
  const productPriceSelectOptions = useMemo<SelectInputOption[]>(() => {
    return [
      { value: "", label: isPricesLoading ? "Loading prices..." : "Select product" },
      ...productPriceOptions.map((productPrice) => ({
        value: String(productPrice.id),
        label: getPriceLabel(productPrice),
      })),
    ];
  }, [isPricesLoading, productPriceOptions]);

  const invoiceSummary = useMemo<InvoiceSummaryData>(() => {
    const summaryItems = items
      .map((item) => {
        const price = priceById.get(item.product_price_id);
        const quantity = toNumber(item.quantity);
        const sellPrice = toNumber(price?.sell_price ?? "0");
        const lineTotal = item.line_total.trim() ? toNumber(item.line_total) : sellPrice * quantity;

        if (!price) {
          return null;
        }

        return {
          productName: price.product?.product_name ?? "Deleted product",
          unitName: price.unit?.unit_name ?? null,
          price: sellPrice,
          quantity,
          lineTotal,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const subtotalAmount = summaryItems.reduce((total, item) => total + item.lineTotal, 0);
    const discountAmount = toNumber(form.discount_amount);
    const totalAmount = Math.max(0, subtotalAmount - discountAmount);
    const paidAmount = form.payment_type === "due" ? 0 : totalAmount;

    return {
      invoiceNo: invoiceNo || "Generating...",
      invoiceDatetime: form.invoice_date ? buildInvoiceDateTime(form.invoice_date, invoice?.invoice_datetime) : null,
      customerName: form.customer_name.trim() || "-",
      customerMobile: form.customer_mobile.trim() || null,
      vehicleNo: form.vehicle_no.trim() || null,
      paymentType: form.payment_type,
      paymentStatus: paidAmount >= totalAmount ? "paid" : "unpaid",
      status: "submitted",
      subtotalAmount,
      discountAmount,
      totalAmount,
      paidAmount,
      dueAmount: totalAmount - paidAmount,
      items: summaryItems,
    };
  }, [form, invoice?.invoice_datetime, invoiceNo, items, priceById]);

  useEffect(() => {
    if (customerLookupTerm.length < 2 || customerMatches.length === 0) {
      return;
    }

    const mobile = normalizeLookupValue(form.customer_mobile);
    const vehicleNo = normalizeLookupValue(form.vehicle_no);
    const matchedCustomer = customerMatches.find((customer) => {
      const matchedMobile = mobile && normalizeLookupValue(customer.mobile) === mobile;
      const matchedVehicleNo = vehicleNo && normalizeLookupValue(customer.vehicle_no) === vehicleNo;

      return matchedMobile || matchedVehicleNo;
    });

    if (!matchedCustomer || form.customer_id === String(matchedCustomer.id)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setForm((current) => ({
        ...current,
        customer_id: String(matchedCustomer.id),
        customer_name: matchedCustomer.name,
        customer_mobile: matchedCustomer.mobile ?? current.customer_mobile,
        vehicle_no: matchedCustomer.vehicle_no ?? current.vehicle_no,
      }));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [customerLookupTerm, customerMatches, form.customer_id, form.customer_mobile, form.vehicle_no]);

  function updateFormValue<K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) {
    setForm((current) => {
      if (key === "customer_mobile" || key === "vehicle_no") {
        return {
          ...current,
          customer_id: "",
          [key]: value,
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function updateItemProduct(index: number, productPriceId: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const price = priceById.get(productPriceId);
        const sellPrice = toNumber(price?.sell_price ?? "0");
        const quantity = Number(item.quantity);
        const total = Number(item.line_total);

        if (price && Number.isFinite(quantity) && quantity > 0) {
          return {
            ...item,
            product_price_id: productPriceId,
            line_total: formatCalculatedAmount(sellPrice * quantity),
          };
        }

        if (price && Number.isFinite(total) && total > 0 && sellPrice > 0) {
          return {
            ...item,
            product_price_id: productPriceId,
            quantity: formatCalculatedQuantity(total / sellPrice),
          };
        }

        return {
          ...item,
          product_price_id: productPriceId,
        };
      }),
    );
  }

  function updateItemQuantity(index: number, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const price = priceById.get(item.product_price_id);
        const sellPrice = toNumber(price?.sell_price ?? "0");
        const quantity = Number(value);

        return {
          ...item,
          quantity: value,
          line_total: price && Number.isFinite(quantity) && quantity > 0 ? formatCalculatedAmount(sellPrice * quantity) : "",
        };
      }),
    );
  }

  function updateItemLineTotal(index: number, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const price = priceById.get(item.product_price_id);
        const sellPrice = toNumber(price?.sell_price ?? "0");
        const lineTotal = Number(value);

        return {
          ...item,
          line_total: value,
          quantity: price && sellPrice > 0 && Number.isFinite(lineTotal) && lineTotal > 0 ? formatCalculatedQuantity(lineTotal / sellPrice) : "",
        };
      }),
    );
  }

  function addItem() {
    setItems((current) => [...current, createEmptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  function toggleDiscountInput() {
    if (isDiscountInputOpen) {
      setIsDiscountInputOpen(false);
      return;
    }

    setDiscountDraft(form.discount_amount || "0");
    setIsDiscountInputOpen(true);
  }

  function applyDiscount() {
    const discountAmount = Number(discountDraft || 0);

    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      setFormError("Discount must be 0 or greater.");
      return;
    }

    if (discountAmount > invoiceSummary.subtotalAmount) {
      setFormError("Discount cannot be greater than subtotal.");
      return;
    }

    updateFormValue("discount_amount", String(discountAmount));
    setFormError(null);
    setIsDiscountInputOpen(false);
  }

  function validateForm() {
    if (!invoiceNo) {
      return "Invoice no is required.";
    }

    if (!form.invoice_date) {
      return "Invoice date is required.";
    }

    if (!form.customer_id) {
      const customerName = form.customer_name.trim();
      const customerMobile = form.customer_mobile.trim();
      const vehicleNo = form.vehicle_no.trim();

      if (!customerName) {
        return "Customer name is required.";
      }

      if (customerName.length > 120) {
        return "Customer name must be 120 characters or fewer.";
      }

      if (customerMobile.length > 20) {
        return "Customer mobile must be 20 characters or fewer.";
      }

      if (customerMobile && !mobilePattern.test(customerMobile)) {
        return "Customer mobile can only contain numbers, spaces, plus, dashes, and brackets.";
      }

      if (vehicleNo.length > 50) {
        return "Vehicle no must be 50 characters or fewer.";
      }
    }

    if (items.length === 0) {
      return "At least one product is required.";
    }

    for (const [index, item] of items.entries()) {
      const price = priceById.get(item.product_price_id);
      const quantity = Number(item.quantity);

      if (!price) {
        return `Product is required for row ${index + 1}.`;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        return `Quantity must be greater than 0 for row ${index + 1}.`;
      }
    }

    if (invoiceSummary.discountAmount < 0) {
      return "Discount must be 0 or greater.";
    }

    if (invoiceSummary.discountAmount > invoiceSummary.subtotalAmount) {
      return "Discount cannot be greater than subtotal.";
    }

    return null;
  }

  function buildPayload(smsEnabled = false): InvoicePayload {
    const payloadItems = items.map((item) => {
      const price = priceById.get(item.product_price_id);

      if (!price) {
        throw new Error("Missing product price.");
      }

      return {
        product_id: price.product_id,
        product_price_id: price.id,
        product_unit_id: price.product_unit_id,
        price: Number(price.sell_price),
        quantity: Number(item.quantity),
      };
    });
    const payload: InvoicePayload = {
      invoice_no: invoiceNo,
      invoice_datetime: buildInvoiceDateTime(form.invoice_date, invoice?.invoice_datetime),
      payment_type: form.payment_type,
      paid_amount: form.payment_type === "due" ? 0 : null,
      discount_amount: invoiceSummary.discountAmount,
      sms_enabled: smsEnabled,
      status: "submitted",
      items: payloadItems,
    };

    if (form.customer_id) {
      payload.customer_id = Number(form.customer_id);
    } else {
      payload.customer = {
        name: form.customer_name.trim(),
        mobile: form.customer_mobile.trim() || null,
        vehicle_no: form.vehicle_no.trim() || null,
      };
    }

    return payload;
  }

  async function submitPayload(payload: InvoicePayload) {
    const response = invoice
      ? await updateInvoice.mutateAsync({ invoiceId: invoice.id, payload })
      : await createInvoice.mutateAsync(payload);
    router.push(`/invoices/${response.data.id}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const clientError = validateForm();

    if (clientError) {
      setFormError(clientError);
      return;
    }

    try {
      const payload = buildPayload();
      if (!invoice) {
        setPendingCreatePayload(payload);
        setShouldSendSms(false);
        return;
      }

      await submitPayload(payload);
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.invoice_no?.[0] ??
            submissionError.errors?.invoice_datetime?.[0] ??
            submissionError.errors?.customer_id?.[0] ??
            submissionError.errors?.["customer.name"]?.[0] ??
            submissionError.errors?.["customer.mobile"]?.[0] ??
            submissionError.errors?.["customer.vehicle_no"]?.[0] ??
            submissionError.errors?.payment_type?.[0] ??
            submissionError.errors?.discount_amount?.[0] ??
            submissionError.errors?.items?.[0] ??
            submissionError.message,
        );
        return;
      }

      setFormError(`Unable to ${isEditing ? "update" : "submit"} the invoice right now.`);
    }
  }

  async function confirmCreateInvoice() {
    if (!pendingCreatePayload) {
      return;
    }

    setFormError(null);

    try {
      await submitPayload({
        ...pendingCreatePayload,
        sms_enabled: shouldSendSms,
      });
    } catch (submissionError) {
      if (submissionError instanceof ApiClientError) {
        setFormError(
          submissionError.errors?.invoice_no?.[0] ??
            submissionError.errors?.invoice_datetime?.[0] ??
            submissionError.errors?.customer_id?.[0] ??
            submissionError.errors?.["customer.name"]?.[0] ??
            submissionError.errors?.["customer.mobile"]?.[0] ??
            submissionError.errors?.["customer.vehicle_no"]?.[0] ??
            submissionError.errors?.payment_type?.[0] ??
            submissionError.errors?.discount_amount?.[0] ??
            submissionError.errors?.items?.[0] ??
            submissionError.message,
        );
      } else {
        setFormError("Unable to submit the invoice right now.");
      }
      setPendingCreatePayload(null);
    }
  }

  return (
    <main className="shell px-4 py-6 sm:px-6">
      <section className="glass-card mx-auto flex min-h-[124px] w-full max-w-[1328px] flex-col justify-center rounded-[1.5rem] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1f2440]">{isEditing ? "Edit Invoice" : "Create Invoice"}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isEditing ? "Update customer, product, and payment details." : "Create a cash memo with customer, vehicle, product, and payment details."}
            </p>
          </div>

          <Link href="/invoices">
            <Button variant="ghost" className="gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </section>

      <section className="glass-card mx-auto mt-5 w-full max-w-[1328px] overflow-hidden rounded-[1.5rem]">
        <div className="border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <h2 className="text-xl font-semibold text-[#1f2440]">Cash Memo</h2>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-6 px-6 py-6 sm:px-8">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Invoice No</label>
                <TextInput value={isInvoiceNoLoading ? "Generating..." : invoiceNo} autoComplete="off" readOnly disabled={isSubmitting} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Date</label>
                <DatePicker value={form.invoice_date} onChange={(value) => updateFormValue("invoice_date", value)} disabled={isSubmitting} />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Customer Name</label>
                <TextInput
                  placeholder="Customer name"
                  value={form.customer_name}
                  onChange={(event) => updateFormValue("customer_name", event.target.value)}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Customer Mobile Number</label>
                <TextInput
                  placeholder="+8801700000000"
                  value={form.customer_mobile}
                  onChange={(event) => updateFormValue("customer_mobile", event.target.value)}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-[#2d3150]">Vehicle No</label>
                <TextInput
                  placeholder="DHAKA-123"
                  value={form.vehicle_no}
                  onChange={(event) => updateFormValue("vehicle_no", event.target.value)}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-white/70 p-4">
              <p className="mb-3 text-sm font-semibold text-[#2d3150]">Payment</p>
              <div className="flex flex-wrap items-center gap-4">
                {(["cash", "due", "pos"] as InvoicePaymentType[]).map((paymentType) => (
                  <label key={paymentType} className="flex items-center gap-2 text-sm capitalize text-[#2d3150]">
                    <RadioInput
                      name="payment_type"
                      checked={form.payment_type === paymentType}
                      disabled={isSubmitting}
                      onChange={() => updateFormValue("payment_type", paymentType)}
                    />
                    {paymentType === "pos" ? "POS (ATM)" : paymentType}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] lg:items-stretch">
              <section className="flex h-[390px] min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-white/70">
                <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#2d3150]">Cart Products</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">Active product prices will be used for invoice items.</p>
                  </div>
                  <Button type="button" className="h-8 gap-1.5 rounded-full px-3 text-xs" disabled={isFormBusy} onClick={addItem}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Product
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 pr-3">
                  {items.map((item, index) => {
                    return (
                      <div key={item.id} className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 md:grid-cols-[1fr_120px_130px_34px]">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Product</label>
                          <SelectInput
                            value={item.product_price_id}
                            options={productPriceSelectOptions}
                            dropdownLabel="Products"
                            onChange={(nextValue) => updateItemProduct(index, nextValue)}
                            disabled={isFormBusy}
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Quantity</label>
                          <TextInput
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) => updateItemQuantity(index, event.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Total (BDT)</label>
                          <TextInput
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={item.line_total}
                            onChange={(event) => updateItemLineTotal(index, event.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>

                        <div className="flex items-end justify-end">
                          <Button
                            as="span"
                            variant="danger-soft"
                            size="icon-sm"
                            disabled={isSubmitting || items.length === 1}
                            aria-label="Remove product"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 aria-hidden="true" strokeWidth={2} className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="flex h-[390px] min-h-0 flex-col rounded-lg border border-[var(--line)] bg-white/70">
                <div className="border-b border-[var(--line)] px-4 py-4">
                  <h3 className="text-sm font-semibold text-[#2d3150]">Payment Summary</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">Review totals before preview or submit.</p>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div className="space-y-4 text-sm">
                    <p className="flex items-center justify-between text-[var(--muted)]">
                      <span>Subtotal</span>
                      <span>BDT {invoiceSummary.subtotalAmount.toFixed(2)}</span>
                    </p>

                    <div>
                      <div className="flex items-center justify-between gap-3 text-[var(--muted)]">
                        <span>Discount</span>
                        <div className="flex items-center gap-2">
                          <span>BDT {invoiceSummary.discountAmount.toFixed(2)}</span>
                          <span
                            role="button"
                            tabIndex={isSubmitting ? -1 : 0}
                            aria-disabled={isSubmitting}
                            aria-label={isDiscountInputOpen ? "Hide discount input" : "Show discount input"}
                            className={`inline-flex h-5 w-5 select-none items-center justify-center text-sm font-semibold leading-none transition ${
                              isSubmitting ? "cursor-not-allowed text-[var(--muted)] opacity-45" : "cursor-pointer text-[var(--muted)] hover:text-[var(--accent)]"
                            }`}
                            onClick={() => {
                              if (!isSubmitting) {
                                toggleDiscountInput();
                              }
                            }}
                            onKeyDown={(event) => {
                              if (isSubmitting || (event.key !== "Enter" && event.key !== " ")) {
                                return;
                              }

                              event.preventDefault();
                              toggleDiscountInput();
                            }}
                          >
                            {isDiscountInputOpen ? "x" : "+"}
                          </span>
                        </div>
                      </div>

                      <div
                        className={
                          isDiscountInputOpen
                            ? "mt-3 grid max-h-20 grid-cols-[1fr_auto] gap-2 overflow-hidden opacity-100 transition-all duration-200"
                            : "mt-0 grid max-h-0 grid-cols-[1fr_auto] gap-2 overflow-hidden opacity-0 transition-all duration-200"
                        }
                      >
                        <TextInput
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={discountDraft}
                          onChange={(event) => setDiscountDraft(event.target.value)}
                          disabled={!isDiscountInputOpen || isSubmitting}
                        />
                        <Button type="button" className="rounded-full px-4" disabled={!isDiscountInputOpen || isSubmitting} onClick={applyDiscount}>
                          Apply
                        </Button>
                      </div>
                    </div>

                    <p className="flex items-center justify-between border-t border-[var(--line)] pt-4 font-semibold text-[#1f2440]">
                      <span>Total Amount</span>
                      <span>BDT {invoiceSummary.totalAmount.toFixed(2)}</span>
                    </p>
                  </div>

                  <div className="mt-6 rounded-lg bg-[var(--accent-soft)] p-4 text-sm">
                    <p className="flex items-center justify-between text-[var(--muted)]">
                      <span>Payment Type</span>
                      <span className="font-semibold capitalize text-[#2d3150]">{form.payment_type === "pos" ? "POS (ATM)" : form.payment_type}</span>
                    </p>
                    <p className="mt-2 flex items-center justify-between text-[var(--muted)]">
                      <span>Due</span>
                      <span className="font-semibold text-[#2d3150]">BDT {invoiceSummary.dueAmount.toFixed(2)}</span>
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] px-6 py-5 sm:px-8">
            <Link href="/invoices">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </Link>
            <Button type="submit" className="rounded-full px-5" disabled={isFormBusy}>
              {isSubmitting ? "Saving..." : isEditing ? "Update" : "Submit"}
            </Button>
          </div>
        </form>
      </section>

      {pendingCreatePayload ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(35,37,58,0.28)] px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="invoice-confirm-title">
          <div className="w-full max-w-[560px] overflow-hidden rounded-[1rem] border border-[var(--line)] bg-white text-[var(--foreground)] shadow-[0_24px_60px_rgba(35,37,58,0.16)]">
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h2 id="invoice-confirm-title" className="text-lg font-semibold text-[#1f2440]">Confirm Invoice</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Review invoice details before creating this invoice.</p>
            </div>

            <div className="max-h-[calc(100vh-220px)] space-y-4 overflow-y-auto px-5 py-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Invoice</span>
                  <span className="mt-1 block font-semibold text-[#2d3150]">{invoiceSummary.invoiceNo}</span>
                </p>
                <p>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Total</span>
                  <span className="mt-1 block font-semibold text-[#2d3150]">BDT {invoiceSummary.totalAmount.toFixed(2)}</span>
                </p>
                <p>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Customer</span>
                  <span className="mt-1 block font-semibold text-[#2d3150]">{invoiceSummary.customerName}</span>
                </p>
                <p>
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Mobile</span>
                  <span className="mt-1 block font-semibold text-[#2d3150]">{invoiceSummary.customerMobile ?? "-"}</span>
                </p>
              </div>

              <div className="rounded-lg border border-[var(--line)]">
                <div className="grid grid-cols-[1fr_84px_110px] gap-3 border-b border-[var(--line)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <span>Product</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Total</span>
                </div>

                <div className="divide-y divide-[var(--line)]">
                  {invoiceSummary.items.map((item, itemIndex) => (
                    <div key={`${item.productName}-${itemIndex}`} className="grid grid-cols-[1fr_84px_110px] gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#2d3150]">{item.productName}</span>
                        {item.unitName ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{item.unitName}</span> : null}
                      </span>
                      <span className="text-right font-semibold text-[#2d3150]">{item.quantity.toFixed(2)}</span>
                      <span className="text-right font-semibold text-[#2d3150]">BDT {item.lineTotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-[var(--line)] bg-[var(--accent-soft)] px-3 py-3 text-sm">
                  <p className="flex items-center justify-between text-[var(--muted)]">
                    <span>Subtotal</span>
                    <span>BDT {invoiceSummary.subtotalAmount.toFixed(2)}</span>
                  </p>
                  <p className="flex items-center justify-between text-[var(--muted)]">
                    <span>Discount</span>
                    <span>BDT {invoiceSummary.discountAmount.toFixed(2)}</span>
                  </p>
                  <p className="flex items-center justify-between font-semibold text-[#1f2440]">
                    <span>Total</span>
                    <span>BDT {invoiceSummary.totalAmount.toFixed(2)}</span>
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[#2d3150]">
                <CheckboxInput
                  checked={shouldSendSms}
                  disabled={isSubmitting}
                  onChange={(event) => setShouldSendSms(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-semibold">Send SMS</span>
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--line)] px-5 py-4">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full border border-[var(--line)] bg-white px-5 text-[var(--foreground)] hover:bg-white"
                disabled={isSubmitting}
                onClick={() => setPendingCreatePayload(null)}
              >
                Cancel
              </Button>
              <Button type="button" className="rounded-full px-5" disabled={isSubmitting} onClick={() => void confirmCreateInvoice()}>
                {isSubmitting ? "Saving..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function CreateInvoicePage() {
  return <InvoiceFormPage />;
}
