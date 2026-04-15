<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Support\InvoiceNumberHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminInvoiceController extends Controller
{
    public function __construct(private readonly InvoiceNumberHelper $invoiceNumberHelper)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'payment_status' => ['sometimes', 'nullable', Rule::in(['unpaid', 'partial', 'paid'])],
            'status' => ['sometimes', 'nullable', Rule::in(['draft', 'submitted', 'cancelled'])],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $invoices = Invoice::query()
            ->with(['customer', 'items.product', 'items.unit'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('invoice_no', 'like', "%{$search}%")
                        ->orWhereHas('customer', function ($query) use ($search): void {
                            $query
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('mobile', 'like', "%{$search}%")
                                ->orWhere('vehicle_no', 'like', "%{$search}%");
                        });
                });
            })
            ->when(! empty($validated['payment_type']), fn ($query) => $query->where('payment_type', $validated['payment_type']))
            ->when(! empty($validated['payment_status']), fn ($query) => $query->where('payment_status', $validated['payment_status']))
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('invoice_datetime', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('invoice_datetime', '<=', $validated['date_to']))
            ->orderByDesc('invoice_datetime')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $invoices->getCollection()->map(fn (Invoice $invoice): array => $this->serializeInvoice($invoice))->values(),
            'meta' => $this->paginationMeta($invoices),
            'links' => $this->paginationLinks($invoices),
        ]);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeInvoice($invoice->load(['customer', 'items.product', 'items.unit', 'smsLogs'])),
        ]);
    }

    public function nextNumber(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['sometimes', 'nullable', 'date'],
        ]);

        return response()->json([
            'data' => [
                'invoice_no' => $this->invoiceNumberHelper->generate($validated['date'] ?? null),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $invoice = DB::transaction(function () use ($validated, $request): Invoice {
            $customer = $this->resolveCustomer($validated);
            $preparedItems = $this->prepareItems($validated['items']);
            $amounts = $this->calculateAmounts($preparedItems, $validated);
            $invoiceNo = $this->resolveInvoiceNo($validated);

            $invoice = Invoice::query()->create([
                'invoice_no' => $invoiceNo,
                'invoice_datetime' => $validated['invoice_datetime'],
                'customer_id' => $customer->id,
                'payment_type' => $validated['payment_type'],
                'payment_status' => $amounts['payment_status'],
                'subtotal_amount' => $amounts['subtotal_amount'],
                'discount_amount' => $amounts['discount_amount'],
                'total_amount' => $amounts['total_amount'],
                'paid_amount' => $amounts['paid_amount'],
                'due_amount' => $amounts['due_amount'],
                'sms_enabled' => (bool) $validated['sms_enabled'],
                'status' => $validated['status'],
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);

            $invoice->items()->createMany($preparedItems);

            return $invoice;
        });

        return response()->json([
            'data' => $this->serializeInvoice($invoice->fresh(['customer', 'items.product', 'items.unit', 'smsLogs'])),
        ], 201);
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        $validated = $request->validate($this->rules($invoice));

        $invoice = DB::transaction(function () use ($validated, $invoice, $request): Invoice {
            $customer = $this->resolveCustomer($validated);
            $preparedItems = $this->prepareItems($validated['items']);
            $amounts = $this->calculateAmounts($preparedItems, $validated);

            $invoice->forceFill([
                'invoice_no' => $validated['invoice_no'],
                'invoice_datetime' => $validated['invoice_datetime'],
                'customer_id' => $customer->id,
                'payment_type' => $validated['payment_type'],
                'payment_status' => $amounts['payment_status'],
                'subtotal_amount' => $amounts['subtotal_amount'],
                'discount_amount' => $amounts['discount_amount'],
                'total_amount' => $amounts['total_amount'],
                'paid_amount' => $amounts['paid_amount'],
                'due_amount' => $amounts['due_amount'],
                'sms_enabled' => (bool) $validated['sms_enabled'],
                'status' => $validated['status'],
                'updated_by' => $request->user()?->id,
            ])->save();

            $invoice->items()->delete();
            $invoice->items()->createMany($preparedItems);

            return $invoice;
        });

        return response()->json([
            'data' => $this->serializeInvoice($invoice->fresh(['customer', 'items.product', 'items.unit', 'smsLogs'])),
        ]);
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $invoice->delete();

        return response()->json([], 204);
    }

    protected function rules(?Invoice $invoice = null): array
    {
        return [
            'invoice_no' => [
                $invoice ? 'required' : 'nullable',
                'string',
                'max:50',
                'regex:' . $this->invoiceNumberHelper->pattern(),
                Rule::unique('invoices', 'invoice_no')->ignore($invoice?->id),
            ],
            'invoice_datetime' => ['required', 'date'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'customer.name' => ['required_without:customer_id', 'string', 'max:120'],
            'customer.mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'customer.vehicle_no' => ['nullable', 'string', 'max:50'],
            'payment_type' => ['required', Rule::in(['due', 'cash', 'pos'])],
            'paid_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'discount_amount' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'sms_enabled' => ['required', 'boolean'],
            'status' => ['required', Rule::in(['draft', 'submitted', 'cancelled'])],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_price_id' => ['nullable', 'integer', 'exists:product_prices,id'],
            'items.*.product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'items.*.price' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001', 'max:99999999.9999'],
        ];
    }

    protected function resolveInvoiceNo(array $validated): string
    {
        if (! empty($validated['invoice_no'])) {
            return $this->invoiceNumberHelper->normalize($validated['invoice_no']);
        }

        return $this->invoiceNumberHelper->generate(Carbon::parse($validated['invoice_datetime']));
    }

    protected function resolveCustomer(array $validated): Customer
    {
        if (! empty($validated['customer_id'])) {
            return Customer::query()->findOrFail($validated['customer_id']);
        }

        $customerPayload = $validated['customer'];
        $mobile = trim((string) ($customerPayload['mobile'] ?? ''));
        $vehicleNo = trim((string) ($customerPayload['vehicle_no'] ?? ''));

        if ($mobile !== '') {
            $customer = Customer::query()->firstOrNew(['mobile' => $mobile]);
            $customer->forceFill([
                'name' => $customerPayload['name'],
                'vehicle_no' => $vehicleNo !== '' ? $vehicleNo : $customer->vehicle_no,
            ])->save();

            return $customer;
        }

        if ($vehicleNo !== '') {
            $customer = Customer::query()->firstOrNew(['vehicle_no' => $vehicleNo]);
            $customer->forceFill([
                'name' => $customerPayload['name'],
                'mobile' => $mobile !== '' ? $mobile : $customer->mobile,
            ])->save();

            return $customer;
        }

        return Customer::query()->create([
            'name' => $customerPayload['name'],
            'mobile' => null,
            'vehicle_no' => null,
        ]);
    }

    protected function prepareItems(array $items): array
    {
        $prepared = [];

        foreach ($items as $index => $item) {
            $product = Product::query()->findOrFail($item['product_id']);
            $price = ! empty($item['product_price_id'])
                ? ProductPrice::query()->with('unit')->findOrFail($item['product_price_id'])
                : ProductPrice::query()->with('unit')->where('product_id', $product->id)->where('is_active', true)->first();

            if (! $price && ! array_key_exists('price', $item)) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_price_id" => 'Select a price or create an active product price first.',
                ]);
            }

            if ($price && $price->product_id !== $product->id) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_price_id" => 'Selected price does not belong to this product.',
                ]);
            }

            $unit = $price?->unit;
            if (! $unit && ! empty($item['product_unit_id'])) {
                $unit = \App\Models\ProductUnit::query()->findOrFail($item['product_unit_id']);
            }

            $quantity = (float) $item['quantity'];
            $linePrice = (float) ($item['price'] ?? $price?->sell_price ?? 0);
            $prepared[] = [
                'product_id' => $product->id,
                'product_price_id' => $price?->id,
                'product_unit_id' => $unit?->id,
                'product_name' => $product->product_name,
                'unit_name' => $unit?->unit_name,
                'unit_code' => $unit?->unit_code,
                'unit_value' => $unit?->unit_value ?? 1,
                'price' => round($linePrice, 2),
                'quantity' => $quantity,
                'line_total' => round($linePrice * $quantity, 2),
            ];
        }

        return $prepared;
    }

    protected function calculateAmounts(array $preparedItems, array $validated): array
    {
        $subtotal = round(array_sum(array_column($preparedItems, 'line_total')), 2);
        $discount = round((float) ($validated['discount_amount'] ?? 0), 2);

        if ($discount > $subtotal) {
            throw ValidationException::withMessages([
                'discount_amount' => 'Discount cannot be greater than subtotal amount.',
            ]);
        }

        $total = round($subtotal - $discount, 2);
        $paid = array_key_exists('paid_amount', $validated) && $validated['paid_amount'] !== null
            ? round((float) $validated['paid_amount'], 2)
            : ($validated['payment_type'] === 'due' ? 0.0 : $total);

        if ($paid > $total) {
            throw ValidationException::withMessages([
                'paid_amount' => 'Paid amount cannot be greater than total amount.',
            ]);
        }

        $due = round($total - $paid, 2);

        return [
            'subtotal_amount' => $subtotal,
            'discount_amount' => $discount,
            'total_amount' => $total,
            'paid_amount' => $paid,
            'due_amount' => $due,
            'payment_status' => $due <= 0 ? 'paid' : ($paid > 0 ? 'partial' : 'unpaid'),
        ];
    }

    protected function serializeInvoice(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'invoice_no' => $invoice->invoice_no,
            'invoice_datetime' => $invoice->invoice_datetime?->toIso8601String(),
            'customer' => $invoice->customer ? [
                'id' => $invoice->customer->id,
                'name' => $invoice->customer->name,
                'mobile' => $invoice->customer->mobile,
                'vehicle_no' => $invoice->customer->vehicle_no,
            ] : null,
            'payment_type' => $invoice->payment_type,
            'payment_status' => $invoice->payment_status,
            'subtotal_amount' => $invoice->subtotal_amount,
            'discount_amount' => $invoice->discount_amount,
            'total_amount' => $invoice->total_amount,
            'paid_amount' => $invoice->paid_amount,
            'due_amount' => $invoice->due_amount,
            'sms_enabled' => $invoice->sms_enabled,
            'status' => $invoice->status,
            'items' => $invoice->items->map(fn ($item): array => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_price_id' => $item->product_price_id,
                'product_unit_id' => $item->product_unit_id,
                'product_name' => $item->product_name,
                'unit_name' => $item->unit_name,
                'unit_code' => $item->unit_code,
                'unit_value' => $item->unit_value,
                'price' => $item->price,
                'quantity' => $item->quantity,
                'line_total' => $item->line_total,
            ])->values(),
            'sms_logs' => $invoice->relationLoaded('smsLogs') ? $invoice->smsLogs->map(fn ($log): array => [
                'id' => $log->id,
                'mobile' => $log->mobile,
                'status' => $log->status,
                'sent_at' => $log->sent_at?->toIso8601String(),
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values() : [],
            'created_at' => $invoice->created_at?->toIso8601String(),
            'updated_at' => $invoice->updated_at?->toIso8601String(),
        ];
    }

    protected function paginationMeta($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'from' => $paginator->firstItem(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'to' => $paginator->lastItem(),
            'total' => $paginator->total(),
        ];
    }

    protected function paginationLinks($paginator): array
    {
        return [
            'first' => $paginator->url(1),
            'last' => $paginator->url($paginator->lastPage()),
            'prev' => $paginator->previousPageUrl(),
            'next' => $paginator->nextPageUrl(),
        ];
    }
}
