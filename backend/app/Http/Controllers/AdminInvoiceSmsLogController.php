<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Models\InvoiceSmsLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminInvoiceSmsLogController extends Controller
{
    use InteractsWithPdfReports;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'status' => ['sometimes', 'nullable', Rule::in(['pending', 'sent', 'failed'])],
            'invoice_id' => ['sometimes', 'nullable', 'integer', 'exists:invoices,id'],
            'customer_id' => ['sometimes', 'nullable', 'integer', 'exists:customers,id'],
            'sms_service_credential_id' => ['sometimes', 'nullable', 'integer', 'exists:sms_service_credentials,id'],
            'invoice_sms_template_id' => ['sometimes', 'nullable', 'integer', 'exists:invoice_sms_templates,id'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $logs = InvoiceSmsLog::query()
            ->with(['invoice.customer', 'customer', 'credential', 'template'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('mobile', 'like', "%{$search}%")
                        ->orWhere('recipient_name', 'like', "%{$search}%")
                        ->orWhere('sender_id', 'like', "%{$search}%")
                        ->orWhere('message', 'like', "%{$search}%")
                        ->orWhereHas('invoice', fn ($query) => $query->where('invoice_no', 'like', "%{$search}%"));
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['invoice_id']), fn ($query) => $query->where('invoice_id', $validated['invoice_id']))
            ->when(! empty($validated['customer_id']), fn ($query) => $query->where('customer_id', $validated['customer_id']))
            ->when(! empty($validated['sms_service_credential_id']), fn ($query) => $query->where('sms_service_credential_id', $validated['sms_service_credential_id']))
            ->when(! empty($validated['invoice_sms_template_id']), fn ($query) => $query->where('invoice_sms_template_id', $validated['invoice_sms_template_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('created_at', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('created_at', '<=', $validated['date_to']))
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $logs->getCollection()->map(fn (InvoiceSmsLog $log): array => $this->serializeLog($log))->values(),
            'meta' => $this->paginationMeta($logs),
            'links' => $this->paginationLinks($logs),
        ]);
    }

    public function show(InvoiceSmsLog $invoiceSmsLog): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeLog($invoiceSmsLog->load(['invoice.customer', 'customer', 'credential', 'template'])),
        ]);
    }

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'status' => ['sometimes', 'nullable', Rule::in(['pending', 'sent', 'failed'])],
            'invoice_id' => ['sometimes', 'nullable', 'integer', 'exists:invoices,id'],
            'customer_id' => ['sometimes', 'nullable', 'integer', 'exists:customers,id'],
            'sms_service_credential_id' => ['sometimes', 'nullable', 'integer', 'exists:sms_service_credentials,id'],
            'invoice_sms_template_id' => ['sometimes', 'nullable', 'integer', 'exists:invoice_sms_templates,id'],
            'date_from' => ['sometimes', 'nullable', 'date'],
            'date_to' => ['sometimes', 'nullable', 'date', 'after_or_equal:date_from'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $logs = InvoiceSmsLog::query()
            ->with(['invoice.customer', 'customer', 'credential', 'template'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('mobile', 'like', "%{$search}%")
                        ->orWhere('recipient_name', 'like', "%{$search}%")
                        ->orWhere('sender_id', 'like', "%{$search}%")
                        ->orWhere('message', 'like', "%{$search}%")
                        ->orWhereHas('invoice', fn ($query) => $query->where('invoice_no', 'like', "%{$search}%"));
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->when(! empty($validated['invoice_id']), fn ($query) => $query->where('invoice_id', $validated['invoice_id']))
            ->when(! empty($validated['customer_id']), fn ($query) => $query->where('customer_id', $validated['customer_id']))
            ->when(! empty($validated['sms_service_credential_id']), fn ($query) => $query->where('sms_service_credential_id', $validated['sms_service_credential_id']))
            ->when(! empty($validated['invoice_sms_template_id']), fn ($query) => $query->where('invoice_sms_template_id', $validated['invoice_sms_template_id']))
            ->when(! empty($validated['date_from']), fn ($query) => $query->where('created_at', '>=', $validated['date_from']))
            ->when(! empty($validated['date_to']), fn ($query) => $query->where('created_at', '<=', $validated['date_to']))
            ->orderByDesc('id')
            ->get();

        $rows = $logs->values()->map(fn (InvoiceSmsLog $log, int $index): array => [
            (string) ($index + 1),
            $log->invoice?->invoice_no ?? '#'.$log->invoice_id,
            $log->recipient_name ?: ($log->customer?->name ?? '-'),
            $log->mobile,
            $log->template?->name ?? '-',
            ucfirst($log->status),
            $this->pdfDateTime($log->sent_at ?: $log->created_at),
        ])->all();

        return $this->downloadTableReportPdf('Invoice SMS Logs', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Invoice', 'width' => '105px'],
            ['label' => 'Recipient'],
            ['label' => 'Mobile', 'width' => '110px'],
            ['label' => 'Template', 'width' => '110px'],
            ['label' => 'Status', 'width' => '70px', 'align' => 'center'],
            ['label' => 'Sent', 'width' => '115px', 'align' => 'center'],
        ], $rows, $generatedAt, 'invoice-sms-logs');
    }

    protected function serializeLog(InvoiceSmsLog $log): array
    {
        return [
            'id' => $log->id,
            'invoice_id' => $log->invoice_id,
            'invoice' => $log->invoice ? [
                'id' => $log->invoice->id,
                'invoice_no' => $log->invoice->invoice_no,
                'total_amount' => $log->invoice->total_amount,
                'customer' => $log->invoice->customer ? [
                    'id' => $log->invoice->customer->id,
                    'name' => $log->invoice->customer->name,
                    'mobile' => $log->invoice->customer->mobile,
                ] : null,
            ] : null,
            'customer_id' => $log->customer_id,
            'customer' => $log->customer ? [
                'id' => $log->customer->id,
                'name' => $log->customer->name,
                'mobile' => $log->customer->mobile,
                'vehicle_no' => $log->customer->vehicle_no,
            ] : null,
            'sms_service_credential_id' => $log->sms_service_credential_id,
            'credential' => $log->credential ? [
                'id' => $log->credential->id,
                'url' => $log->credential->url,
                'sender_id' => $log->credential->sender_id,
                'status' => $log->credential->status,
            ] : null,
            'invoice_sms_template_id' => $log->invoice_sms_template_id,
            'template' => $log->template ? [
                'id' => $log->template->id,
                'name' => $log->template->name,
                'status' => $log->template->status,
            ] : null,
            'recipient_name' => $log->recipient_name,
            'mobile' => $log->mobile,
            'sender_id' => $log->sender_id,
            'message' => $log->message,
            'status' => $log->status,
            'provider_response' => $log->provider_response,
            'sent_at' => $log->sent_at?->toIso8601String(),
            'created_at' => $log->created_at?->toIso8601String(),
            'updated_at' => $log->updated_at?->toIso8601String(),
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
