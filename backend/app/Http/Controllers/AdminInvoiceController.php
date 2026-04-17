<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use App\Models\ProductPrice;
use App\Models\ProductUnit;
use App\Services\Invoices\InvoiceSmsService;
use App\Support\InvoiceNumberHelper;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminInvoiceController extends Controller
{
    use InteractsWithPdfReports;

    public function __construct(
        private readonly InvoiceNumberHelper $invoiceNumberHelper,
        private readonly InvoiceSmsService $invoiceSmsService,
    ) {}

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
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $invoices = Invoice::query()
            ->with(['customer', 'items.product', 'items.unit', 'smsLogs'])
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
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('invoice_datetime', '>=', Carbon::parse($validated['date_from'])->startOfDay()))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('invoice_datetime', '<=', Carbon::parse($validated['date_to'])->endOfDay()))
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

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'payment_status' => ['sometimes', 'nullable', Rule::in(['unpaid', 'partial', 'paid'])],
            'status' => ['sometimes', 'nullable', Rule::in(['draft', 'submitted', 'cancelled'])],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $invoices = Invoice::query()
            ->with(['customer', 'items.product', 'items.unit', 'smsLogs'])
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
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('invoice_datetime', '>=', Carbon::parse($validated['date_from'])->startOfDay()))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('invoice_datetime', '<=', Carbon::parse($validated['date_to'])->endOfDay()))
            ->orderByDesc('invoice_datetime')
            ->orderByDesc('id')
            ->get();

        $rows = $invoices->values()->map(fn (Invoice $invoice, int $index): array => [
            (string) ($index + 1),
            $invoice->invoice_no,
            $invoice->customer?->name ?? '-',
            strtoupper($invoice->payment_type),
            $this->pdfMoney($invoice->total_amount),
            $this->pdfMoney($invoice->paid_amount),
            $this->pdfMoney($invoice->due_amount),
            ucfirst($invoice->status),
            $this->pdfDateTime($invoice->invoice_datetime),
        ])->all();

        return $this->downloadTableReportPdf('Invoices List', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Invoice', 'width' => '110px'],
            ['label' => 'Customer'],
            ['label' => 'Payment', 'width' => '70px', 'align' => 'center'],
            ['label' => 'Total', 'width' => '82px', 'align' => 'right'],
            ['label' => 'Paid', 'width' => '82px', 'align' => 'right'],
            ['label' => 'Due', 'width' => '82px', 'align' => 'right'],
            ['label' => 'Status', 'width' => '70px', 'align' => 'center'],
            ['label' => 'Date', 'width' => '115px', 'align' => 'center'],
        ], $rows, $generatedAt, 'invoices');
    }

    public function exportDetailPdf(Invoice $invoice)
    {
        $invoice->load(['customer', 'items.product', 'items.unit', 'smsLogs', 'creator']);
        $generatedAt = now();

        $pdf = Pdf::loadView('pdf.reports.invoice-detail', [
            ...$this->companyPdfViewData(),
            'reportTitle' => 'Sale Invoice',
            'invoice' => $invoice,
            'generatedAt' => $generatedAt,
            'amountInWords' => $this->invoiceAmountInWords($invoice->total_amount),
            'preparedBy' => $this->pdfText($invoice->creator?->name, '-'),
        ])->setPaper('a4', 'portrait');

        return $pdf->download($this->pdfFilename('invoice-'.$invoice->id, $generatedAt));
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

    public function dailyStatement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['sometimes', 'nullable', 'date'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'created_by' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        [$start, $end] = $this->resolveStatementRange(
            $validated,
            Carbon::parse($validated['date'] ?? now())->startOfDay(),
            Carbon::parse($validated['date'] ?? now())->endOfDay(),
        );
        $filters = $this->resolveStatementFilters($validated);
        $baseQuery = $this->statementInvoiceQuery($start, $end, $filters);

        $invoices = (clone $baseQuery)
            ->with('customer')
            ->withCount('items')
            ->orderBy('invoice_datetime')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => [
                'period_type' => 'daily',
                'date' => $start->toDateString(),
                'range' => $this->statementRange($start, $end),
                'filters' => $filters,
                'summary' => $this->statementSummary($baseQuery, $start, $end, $filters),
                'product_summaries' => $this->statementProductSummaries($start, $end, $filters),
                'invoices' => $invoices->map(fn (Invoice $invoice): array => $this->serializeStatementInvoice($invoice))->values(),
            ],
        ]);
    }

    public function exportDailyStatementPdf(Request $request)
    {
        $validated = $request->validate([
            'date' => ['sometimes', 'nullable', 'date'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'created_by' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        [$start, $end] = $this->resolveStatementRange(
            $validated,
            Carbon::parse($validated['date'] ?? now())->startOfDay(),
            Carbon::parse($validated['date'] ?? now())->endOfDay(),
        );
        $filters = $this->resolveStatementFilters($validated);
        $baseQuery = $this->statementInvoiceQuery($start, $end, $filters);
        $summary = $this->statementSummary($baseQuery, $start, $end, $filters);
        $productSummaries = $this->statementProductSummaries($start, $end, $filters);
        $invoices = (clone $baseQuery)
            ->with('customer')
            ->withCount('items')
            ->orderBy('invoice_datetime')
            ->orderBy('id')
            ->get();
        $generatedAt = now();

        return $this->downloadStatementReportPdf(
            'Daily Statement',
            [],
            [],
            [
                [
                    'title' => 'Product Summary',
                    'columns' => [
                        ['label' => 'Product'],
                        ['label' => 'Unit', 'width' => '90px'],
                        ['label' => 'Qty', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'Avg Price', 'width' => '90px', 'align' => 'right'],
                        ['label' => 'Total', 'width' => '95px', 'align' => 'right'],
                    ],
                    'rows' => $productSummaries->map(fn (array $product): array => [
                        $product['product_name'],
                        $product['unit_name'] ?: ($product['unit_code'] ?: '-'),
                        $product['quantity'],
                        $this->pdfMoney($product['average_price']),
                        $this->pdfMoney($product['line_total']),
                    ])->all(),
                ],
                [
                    'title' => 'Invoices',
                    'columns' => [
                        ['label' => 'Invoice', 'width' => '105px'],
                        ['label' => 'Customer'],
                        ['label' => 'Payment', 'width' => '80px', 'align' => 'center'],
                        ['label' => 'Total', 'width' => '88px', 'align' => 'right'],
                        ['label' => 'Due', 'width' => '88px', 'align' => 'right'],
                        ['label' => 'Date', 'width' => '110px', 'align' => 'center'],
                    ],
                    'rows' => $invoices->map(fn (Invoice $invoice): array => [
                        $invoice->invoice_no,
                        $invoice->customer?->name ?? '-',
                        strtoupper($invoice->payment_type),
                        $this->pdfMoney($invoice->total_amount),
                        $this->pdfMoney($invoice->due_amount),
                        $this->pdfDateTime($invoice->invoice_datetime),
                    ])->all(),
                ],
            ],
            $generatedAt,
            'daily-statement',
            [
                'totalRecords' => (int) $summary['invoice_count'],
                'periodLabel' => $this->pdfDate($start).' to '.$this->pdfDate($end),
            ]
        );
    }

    public function monthlyStatement(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'month' => ['sometimes', 'nullable', 'date_format:Y-m'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'created_by' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        $month = ! empty($validated['month'])
            ? Carbon::createFromFormat('Y-m', $validated['month'])->startOfMonth()
            : now()->startOfMonth();
        [$start, $end] = $this->resolveStatementRange($validated, $month->copy()->startOfMonth(), $month->copy()->endOfMonth()->endOfDay());
        $filters = $this->resolveStatementFilters($validated);
        $baseQuery = $this->statementInvoiceQuery($start, $end, $filters);
        $dailySummaries = (clone $baseQuery)
            ->selectRaw("
                DATE(invoice_datetime) as statement_date,
                COUNT(*) as invoice_count,
                COALESCE(SUM(subtotal_amount), 0) as subtotal_amount,
                COALESCE(SUM(discount_amount), 0) as discount_amount,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as paid_amount,
                COALESCE(SUM(due_amount), 0) as due_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0) as cash_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'pos' THEN total_amount ELSE 0 END), 0) as pos_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'due' THEN total_amount ELSE 0 END), 0) as due_sales_amount
            ")
            ->groupBy(DB::raw('DATE(invoice_datetime)'))
            ->orderBy('statement_date')
            ->get()
            ->map(fn ($row): array => [
                'statement_date' => $row->statement_date,
                'invoice_count' => (int) $row->invoice_count,
                'subtotal_amount' => $this->formatMoney($row->subtotal_amount),
                'discount_amount' => $this->formatMoney($row->discount_amount),
                'total_amount' => $this->formatMoney($row->total_amount),
                'paid_amount' => $this->formatMoney($row->paid_amount),
                'due_amount' => $this->formatMoney($row->due_amount),
                'cash_amount' => $this->formatMoney($row->cash_amount),
                'pos_amount' => $this->formatMoney($row->pos_amount),
                'due_sales_amount' => $this->formatMoney($row->due_sales_amount),
            ]);

        return response()->json([
            'data' => [
                'period_type' => 'monthly',
                'month' => $month->format('Y-m'),
                'range' => $this->statementRange($start, $end),
                'filters' => $filters,
                'summary' => $this->statementSummary($baseQuery, $start, $end, $filters),
                'daily_summaries' => $dailySummaries->values(),
                'product_summaries' => $this->statementProductSummaries($start, $end, $filters),
            ],
        ]);
    }

    public function exportMonthlyStatementPdf(Request $request)
    {
        $validated = $request->validate([
            'month' => ['sometimes', 'nullable', 'date_format:Y-m'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
            'payment_type' => ['sometimes', 'nullable', Rule::in(['due', 'cash', 'pos'])],
            'created_by' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);

        $month = ! empty($validated['month'])
            ? Carbon::createFromFormat('Y-m', $validated['month'])->startOfMonth()
            : now()->startOfMonth();
        [$start, $end] = $this->resolveStatementRange($validated, $month->copy()->startOfMonth(), $month->copy()->endOfMonth()->endOfDay());
        $filters = $this->resolveStatementFilters($validated);
        $baseQuery = $this->statementInvoiceQuery($start, $end, $filters);
        $summary = $this->statementSummary($baseQuery, $start, $end, $filters);
        $productSummaries = $this->statementProductSummaries($start, $end, $filters);
        $dailySummaries = (clone $baseQuery)
            ->selectRaw("
                DATE(invoice_datetime) as statement_date,
                COUNT(*) as invoice_count,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0) as cash_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'pos' THEN total_amount ELSE 0 END), 0) as pos_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'due' THEN total_amount ELSE 0 END), 0) as due_sales_amount
            ")
            ->groupBy(DB::raw('DATE(invoice_datetime)'))
            ->orderBy('statement_date')
            ->get();
        $generatedAt = now();

        return $this->downloadStatementReportPdf(
            'Monthly Statement',
            [],
            [],
            [
                [
                    'title' => 'Daily Totals',
                    'columns' => [
                        ['label' => 'Date', 'width' => '92px', 'align' => 'center'],
                        ['label' => 'Invoices', 'width' => '64px', 'align' => 'center'],
                        ['label' => 'Cash', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'POS', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'Due Sales', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'Paid', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'Total', 'width' => '90px', 'align' => 'right'],
                    ],
                    'rows' => $dailySummaries->map(fn ($day): array => [
                        $this->pdfDate($day->statement_date),
                        (string) $day->invoice_count,
                        $this->pdfMoney($day->cash_amount),
                        $this->pdfMoney($day->pos_amount),
                        $this->pdfMoney($day->due_sales_amount),
                        $this->pdfMoney($day->paid_amount),
                        $this->pdfMoney($day->total_amount),
                    ])->all(),
                ],
                [
                    'title' => 'Product Summary',
                    'columns' => [
                        ['label' => 'Product'],
                        ['label' => 'Unit', 'width' => '90px'],
                        ['label' => 'Qty', 'width' => '82px', 'align' => 'right'],
                        ['label' => 'Avg Price', 'width' => '90px', 'align' => 'right'],
                        ['label' => 'Total', 'width' => '95px', 'align' => 'right'],
                    ],
                    'rows' => $productSummaries->map(fn (array $product): array => [
                        $product['product_name'],
                        $product['unit_name'] ?: ($product['unit_code'] ?: '-'),
                        $product['quantity'],
                        $this->pdfMoney($product['average_price']),
                        $this->pdfMoney($product['line_total']),
                    ])->all(),
                ],
            ],
            $generatedAt,
            'monthly-statement',
            [
                'totalRecords' => (int) $summary['invoice_count'],
                'periodLabel' => $this->pdfDate($start).' to '.$this->pdfDate($end),
            ]
        );
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

        $this->invoiceSmsService->sendInvoiceCreatedNotification($invoice);

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

    public function resendSms(Invoice $invoice): JsonResponse
    {
        $log = $this->invoiceSmsService->sendInvoiceCreatedNotification($invoice, force: true);

        return response()->json([
            'data' => $this->serializeInvoice($invoice->fresh(['customer', 'items.product', 'items.unit', 'smsLogs'])),
            'sms_log' => $log ? [
                'id' => $log->id,
                'mobile' => $log->mobile,
                'status' => $log->status,
                'sent_at' => $log->sent_at?->toIso8601String(),
                'created_at' => $log->created_at?->toIso8601String(),
            ] : null,
        ]);
    }

    protected function rules(?Invoice $invoice = null): array
    {
        return [
            'invoice_no' => [
                $invoice ? 'required' : 'nullable',
                'string',
                'max:50',
                'regex:'.$this->invoiceNumberHelper->pattern(),
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
                $unit = ProductUnit::query()->findOrFail($item['product_unit_id']);
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
            'sms_status' => $this->resolveSmsStatus($invoice),
            'sms_sent_at' => $this->resolveSmsSentAt($invoice),
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

    protected function resolveSmsStatus(Invoice $invoice): string
    {
        if (! $invoice->relationLoaded('smsLogs') || $invoice->smsLogs->isEmpty()) {
            return 'not_sent';
        }

        if ($invoice->smsLogs->contains(fn ($log): bool => $log->status === 'sent')) {
            return 'sent';
        }

        if ($invoice->smsLogs->contains(fn ($log): bool => $log->status === 'pending')) {
            return 'pending';
        }

        return 'failed';
    }

    protected function resolveSmsSentAt(Invoice $invoice): ?string
    {
        if (! $invoice->relationLoaded('smsLogs')) {
            return null;
        }

        $sentLog = $invoice->smsLogs
            ->filter(fn ($log): bool => $log->status === 'sent' && $log->sent_at !== null)
            ->sortByDesc('sent_at')
            ->first();

        return $sentLog?->sent_at?->toIso8601String();
    }

    protected function resolveStatementRange(array $validated, Carbon $defaultStart, Carbon $defaultEnd): array
    {
        $start = ! empty($validated['date_from'])
            ? Carbon::parse($validated['date_from'])->startOfDay()
            : $defaultStart->copy()->startOfDay();
        $end = ! empty($validated['date_to'])
            ? Carbon::parse($validated['date_to'])->endOfDay()
            : $defaultEnd->copy()->endOfDay();

        return [$start, $end];
    }

    protected function resolveStatementFilters(array $validated): array
    {
        return [
            'payment_type' => $validated['payment_type'] ?? null,
            'created_by' => isset($validated['created_by']) ? (int) $validated['created_by'] : null,
        ];
    }

    protected function statementInvoiceQuery(Carbon $start, Carbon $end, array $filters = [])
    {
        return Invoice::query()
            ->where('status', 'submitted')
            ->whereBetween('invoice_datetime', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->when(! empty($filters['payment_type']), fn ($query) => $query->where('payment_type', $filters['payment_type']))
            ->when(! empty($filters['created_by']), fn ($query) => $query->where('created_by', $filters['created_by']));
    }

    protected function statementRange(Carbon $start, Carbon $end): array
    {
        return [
            'from' => $start->toIso8601String(),
            'to' => $end->toIso8601String(),
        ];
    }

    protected function statementSummary($baseQuery, Carbon $start, Carbon $end, array $filters = []): array
    {
        $summary = (clone $baseQuery)
            ->selectRaw("
                COUNT(*) as invoice_count,
                COALESCE(SUM(subtotal_amount), 0) as subtotal_amount,
                COALESCE(SUM(discount_amount), 0) as discount_amount,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as paid_amount,
                COALESCE(SUM(due_amount), 0) as due_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0) as cash_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'pos' THEN total_amount ELSE 0 END), 0) as pos_amount,
                COALESCE(SUM(CASE WHEN payment_type = 'due' THEN total_amount ELSE 0 END), 0) as due_sales_amount
            ")
            ->first();
        $itemCount = InvoiceItem::query()
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', 'submitted')
            ->whereBetween('invoices.invoice_datetime', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->when(! empty($filters['payment_type']), fn ($query) => $query->where('invoices.payment_type', $filters['payment_type']))
            ->when(! empty($filters['created_by']), fn ($query) => $query->where('invoices.created_by', $filters['created_by']))
            ->count('invoice_items.id');

        return [
            'invoice_count' => (int) ($summary->invoice_count ?? 0),
            'item_count' => (int) $itemCount,
            'subtotal_amount' => $this->formatMoney($summary->subtotal_amount ?? 0),
            'discount_amount' => $this->formatMoney($summary->discount_amount ?? 0),
            'total_amount' => $this->formatMoney($summary->total_amount ?? 0),
            'paid_amount' => $this->formatMoney($summary->paid_amount ?? 0),
            'due_amount' => $this->formatMoney($summary->due_amount ?? 0),
            'cash_amount' => $this->formatMoney($summary->cash_amount ?? 0),
            'pos_amount' => $this->formatMoney($summary->pos_amount ?? 0),
            'due_sales_amount' => $this->formatMoney($summary->due_sales_amount ?? 0),
        ];
    }

    protected function statementProductSummaries(Carbon $start, Carbon $end, array $filters = [])
    {
        return InvoiceItem::query()
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', 'submitted')
            ->whereBetween('invoices.invoice_datetime', [$start->toDateTimeString(), $end->toDateTimeString()])
            ->when(! empty($filters['payment_type']), fn ($query) => $query->where('invoices.payment_type', $filters['payment_type']))
            ->when(! empty($filters['created_by']), fn ($query) => $query->where('invoices.created_by', $filters['created_by']))
            ->select([
                'invoice_items.product_name',
                'invoice_items.unit_name',
                'invoice_items.unit_code',
            ])
            ->selectRaw('
                COUNT(DISTINCT invoice_items.invoice_id) as invoice_count,
                COUNT(invoice_items.id) as item_count,
                COALESCE(SUM(invoice_items.quantity), 0) as quantity,
                COALESCE(SUM(invoice_items.line_total), 0) as line_total,
                CASE
                    WHEN COALESCE(SUM(invoice_items.quantity), 0) > 0
                    THEN COALESCE(SUM(invoice_items.line_total), 0) / SUM(invoice_items.quantity)
                    ELSE 0
                END as average_price
            ')
            ->groupBy('invoice_items.product_name', 'invoice_items.unit_name', 'invoice_items.unit_code')
            ->orderByDesc(DB::raw('SUM(invoice_items.line_total)'))
            ->orderBy('invoice_items.product_name')
            ->get()
            ->map(fn ($row): array => [
                'product_name' => $row->product_name,
                'unit_name' => $row->unit_name,
                'unit_code' => $row->unit_code,
                'invoice_count' => (int) $row->invoice_count,
                'item_count' => (int) $row->item_count,
                'quantity' => $this->formatQuantity($row->quantity),
                'line_total' => $this->formatMoney($row->line_total),
                'average_price' => $this->formatMoney($row->average_price),
            ])
            ->values();
    }

    protected function serializeStatementInvoice(Invoice $invoice): array
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
            'total_amount' => $invoice->total_amount,
            'paid_amount' => $invoice->paid_amount,
            'due_amount' => $invoice->due_amount,
            'item_count' => (int) ($invoice->items_count ?? 0),
        ];
    }

    protected function formatMoney($value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    protected function formatQuantity($value): string
    {
        return number_format((float) ($value ?? 0), 4, '.', '');
    }

    protected function invoiceAmountInWords(mixed $value): string
    {
        $amount = round((float) ($value ?? 0), 2);
        $whole = (int) floor($amount);
        $fraction = (int) round(($amount - $whole) * 100);

        $words = $whole > 0 ? $this->numberToWords($whole) : 'Zero';

        if ($fraction > 0) {
            $words .= ' And '.$this->numberToWords($fraction).' Paisa';
        }

        return $words.' Only';
    }

    protected function numberToWords(int $number): string
    {
        $ones = [
            0 => 'Zero',
            1 => 'One',
            2 => 'Two',
            3 => 'Three',
            4 => 'Four',
            5 => 'Five',
            6 => 'Six',
            7 => 'Seven',
            8 => 'Eight',
            9 => 'Nine',
            10 => 'Ten',
            11 => 'Eleven',
            12 => 'Twelve',
            13 => 'Thirteen',
            14 => 'Fourteen',
            15 => 'Fifteen',
            16 => 'Sixteen',
            17 => 'Seventeen',
            18 => 'Eighteen',
            19 => 'Nineteen',
        ];
        $tens = [
            2 => 'Twenty',
            3 => 'Thirty',
            4 => 'Forty',
            5 => 'Fifty',
            6 => 'Sixty',
            7 => 'Seventy',
            8 => 'Eighty',
            9 => 'Ninety',
        ];

        if ($number < 20) {
            return $ones[$number];
        }

        if ($number < 100) {
            $ten = intdiv($number, 10);
            $remainder = $number % 10;

            return $tens[$ten].($remainder > 0 ? ' '.$ones[$remainder] : '');
        }

        if ($number < 1000) {
            $hundreds = intdiv($number, 100);
            $remainder = $number % 100;

            return $ones[$hundreds].' Hundred'.($remainder > 0 ? ' '.$this->numberToWords($remainder) : '');
        }

        if ($number < 1000000) {
            $thousands = intdiv($number, 1000);
            $remainder = $number % 1000;

            return $this->numberToWords($thousands).' Thousand'.($remainder > 0 ? ' '.$this->numberToWords($remainder) : '');
        }

        if ($number < 1000000000) {
            $millions = intdiv($number, 1000000);
            $remainder = $number % 1000000;

            return $this->numberToWords($millions).' Million'.($remainder > 0 ? ' '.$this->numberToWords($remainder) : '');
        }

        $billions = intdiv($number, 1000000000);
        $remainder = $number % 1000000000;

        return $this->numberToWords($billions).' Billion'.($remainder > 0 ? ' '.$this->numberToWords($remainder) : '');
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
