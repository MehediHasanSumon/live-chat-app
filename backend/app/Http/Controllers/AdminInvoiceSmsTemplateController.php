<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Models\InvoiceSmsTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminInvoiceSmsTemplateController extends Controller
{
    use InteractsWithPdfReports;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'inactive'])],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $templates = InvoiceSmsTemplate::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('body', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $templates->getCollection()
                ->map(fn (InvoiceSmsTemplate $template): array => $this->serializeTemplate($template))
                ->values(),
            'meta' => $this->paginationMeta($templates),
            'links' => $this->paginationLinks($templates),
        ]);
    }

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'status' => ['sometimes', 'nullable', Rule::in(['active', 'inactive'])],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $templates = InvoiceSmsTemplate::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('body', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        $rows = $templates->values()->map(fn (InvoiceSmsTemplate $template, int $index): array => [
            (string) ($index + 1),
            $template->name,
            Str::limit($template->body, 80),
            collect($template->variables_json ?? [])->join(', ') ?: '-',
            $template->is_default ? 'Yes' : 'No',
            ucfirst($template->status),
            $this->pdfDate($template->updated_at),
        ])->all();

        return $this->downloadTableReportPdf('Invoice SMS Templates', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Name', 'width' => '120px'],
            ['label' => 'Body'],
            ['label' => 'Variables', 'width' => '120px'],
            ['label' => 'Default', 'width' => '60px', 'align' => 'center'],
            ['label' => 'Status', 'width' => '70px', 'align' => 'center'],
            ['label' => 'Updated', 'width' => '90px', 'align' => 'center'],
        ], $rows, $generatedAt, 'invoice-sms-templates');
    }

    public function options(): JsonResponse
    {
        $templates = InvoiceSmsTemplate::query()
            ->where('status', InvoiceSmsTemplate::STATUS_ACTIVE)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (InvoiceSmsTemplate $template): array => $this->serializeTemplate($template))
            ->values();

        return response()->json(['data' => $templates]);
    }

    public function variables(): JsonResponse
    {
        return response()->json([
            'data' => collect(InvoiceSmsTemplate::VARIABLES)
                ->map(fn (string $variable): array => [
                    'key' => $variable,
                    'token' => '{'.$variable.'}',
                    'blade_token' => '{{ '.$variable.' }}',
                ])
                ->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $template = InvoiceSmsTemplate::query()->create([
            ...$validated,
            'created_by' => $request->user()?->id,
            'updated_by' => $request->user()?->id,
        ]);

        return response()->json([
            'data' => $this->serializeTemplate($template->fresh()),
        ], 201);
    }

    public function show(InvoiceSmsTemplate $invoiceSmsTemplate): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeTemplate($invoiceSmsTemplate),
        ]);
    }

    public function update(Request $request, InvoiceSmsTemplate $invoiceSmsTemplate): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $invoiceSmsTemplate->forceFill([
            ...$validated,
            'updated_by' => $request->user()?->id,
        ])->save();

        return response()->json([
            'data' => $this->serializeTemplate($invoiceSmsTemplate->fresh()),
        ]);
    }

    public function destroy(InvoiceSmsTemplate $invoiceSmsTemplate): JsonResponse
    {
        $invoiceSmsTemplate->delete();

        return response()->json([], 204);
    }

    protected function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:1000'],
            'variables_json' => ['nullable', 'array'],
            'variables_json.*' => ['string', Rule::in(InvoiceSmsTemplate::VARIABLES)],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'is_default' => ['required', 'boolean'],
        ];
    }

    protected function serializeTemplate(InvoiceSmsTemplate $template): array
    {
        return [
            'id' => $template->id,
            'name' => $template->name,
            'body' => $template->body,
            'variables_json' => $template->variables_json,
            'status' => $template->status,
            'is_default' => $template->is_default,
            'created_by' => $template->created_by,
            'updated_by' => $template->updated_by,
            'created_at' => $template->created_at?->toIso8601String(),
            'updated_at' => $template->updated_at?->toIso8601String(),
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
