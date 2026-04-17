<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Http\Resources\StorageObjectResource;
use App\Models\CompanySetting;
use App\Models\StorageObject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCompanySettingController extends Controller
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
        $companySettings = CompanySetting::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('company_name', 'like', "%{$search}%")
                        ->orWhere('proprietor_name', 'like', "%{$search}%")
                        ->orWhere('company_mobile', 'like', "%{$search}%")
                        ->orWhere('company_phone', 'like', "%{$search}%")
                        ->orWhere('company_email', 'like', "%{$search}%")
                        ->orWhere('trade_license', 'like', "%{$search}%")
                        ->orWhere('tin_no', 'like', "%{$search}%")
                        ->orWhere('bin_no', 'like', "%{$search}%")
                        ->orWhere('vat_no', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderBy('company_name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $companySettings->getCollection()->map(fn (CompanySetting $companySetting): array => $this->serializeCompanySetting($companySetting))->values(),
            'meta' => $this->paginationMeta($companySettings),
            'links' => $this->paginationLinks($companySettings),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $companySetting = CompanySetting::query()->create($validated);

        return response()->json([
            'data' => $this->serializeCompanySetting($companySetting),
        ], 201);
    }

    public function show(CompanySetting $companySetting): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeCompanySetting($companySetting),
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
        $companySettings = CompanySetting::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('company_name', 'like', "%{$search}%")
                        ->orWhere('proprietor_name', 'like', "%{$search}%")
                        ->orWhere('company_mobile', 'like', "%{$search}%")
                        ->orWhere('company_phone', 'like', "%{$search}%")
                        ->orWhere('company_email', 'like', "%{$search}%")
                        ->orWhere('trade_license', 'like', "%{$search}%")
                        ->orWhere('tin_no', 'like', "%{$search}%")
                        ->orWhere('bin_no', 'like', "%{$search}%")
                        ->orWhere('vat_no', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderBy('company_name')
            ->get();

        $rows = $companySettings->values()->map(fn (CompanySetting $companySetting, int $index): array => [
            (string) ($index + 1),
            $companySetting->company_name,
            $this->pdfText($companySetting->proprietor_name),
            $this->pdfText($companySetting->company_mobile),
            $this->pdfText($companySetting->company_email),
            $companySetting->currency,
            ucfirst($companySetting->status),
        ])->all();

        return $this->downloadTableReportPdf('Company Settings List', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Company'],
            ['label' => 'Proprietor'],
            ['label' => 'Mobile', 'width' => '110px'],
            ['label' => 'Email'],
            ['label' => 'Currency', 'width' => '70px', 'align' => 'center'],
            ['label' => 'Status', 'width' => '70px', 'align' => 'center'],
        ], $rows, $generatedAt, 'company-settings');
    }

    public function exportDetailPdf(CompanySetting $companySetting)
    {
        $generatedAt = now();

        return $this->downloadDetailReportPdf('Company Details', [
            [
                'title' => 'Company',
                'fields' => [
                    ['label' => 'Company Name', 'value' => $this->pdfText($companySetting->company_name)],
                    ['label' => 'Company Details', 'value' => $this->pdfText($companySetting->company_details)],
                    ['label' => 'Proprietor Name', 'value' => $this->pdfText($companySetting->proprietor_name)],
                    ['label' => 'Currency', 'value' => $this->pdfText($companySetting->currency)],
                    ['label' => 'VAT Rate', 'value' => $this->pdfText($companySetting->vat_rate).' %'],
                    ['label' => 'Status', 'value' => ucfirst($companySetting->status)],
                ],
            ],
            [
                'title' => 'Contact',
                'fields' => [
                    ['label' => 'Mobile', 'value' => $this->pdfText($companySetting->company_mobile)],
                    ['label' => 'Phone', 'value' => $this->pdfText($companySetting->company_phone)],
                    ['label' => 'Email', 'value' => $this->pdfText($companySetting->company_email)],
                    ['label' => 'Company Address', 'value' => $this->pdfText($companySetting->company_address)],
                    ['label' => 'Factory Address', 'value' => $this->pdfText($companySetting->factory_address)],
                ],
            ],
            [
                'title' => 'Compliance',
                'fields' => [
                    ['label' => 'Trade License', 'value' => $this->pdfText($companySetting->trade_license)],
                    ['label' => 'TIN No', 'value' => $this->pdfText($companySetting->tin_no)],
                    ['label' => 'BIN No', 'value' => $this->pdfText($companySetting->bin_no)],
                    ['label' => 'VAT No', 'value' => $this->pdfText($companySetting->vat_no)],
                    ['label' => 'Registration Enabled', 'value' => $companySetting->is_registration_enable ? 'Enabled' : 'Disabled'],
                    ['label' => 'Email Verification', 'value' => $companySetting->is_email_verification_enable ? 'Enabled' : 'Disabled'],
                ],
            ],
        ], $generatedAt, 'company-setting-'.$companySetting->id, [
            'summaryItems' => [
                ['label' => 'Company', 'value' => $companySetting->company_name],
                ['label' => 'Status', 'value' => ucfirst($companySetting->status)],
                ['label' => 'Currency', 'value' => $companySetting->currency],
            ],
        ]);
    }

    public function update(Request $request, CompanySetting $companySetting): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $companySetting->forceFill($validated)->save();

        return response()->json([
            'data' => $this->serializeCompanySetting($companySetting->fresh()),
        ]);
    }

    public function destroy(CompanySetting $companySetting): JsonResponse
    {
        $companySetting->delete();

        return response()->json([], 204);
    }

    protected function rules(): array
    {
        return [
            'company_name' => ['required', 'string', 'max:160'],
            'company_details' => ['nullable', 'string', 'max:2000'],
            'proprietor_name' => ['nullable', 'string', 'max:120'],
            'company_address' => ['nullable', 'string', 'max:2000'],
            'factory_address' => ['nullable', 'string', 'max:2000'],
            'company_mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'company_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+\-\s()]+$/'],
            'company_email' => ['nullable', 'email', 'max:120'],
            'trade_license' => ['nullable', 'string', 'max:80'],
            'tin_no' => ['nullable', 'string', 'max:80'],
            'bin_no' => ['nullable', 'string', 'max:80'],
            'vat_no' => ['nullable', 'string', 'max:80'],
            'vat_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'currency' => ['required', 'string', 'max:10'],
            'company_logo' => ['nullable', 'string', 'max:2048'],
            'is_registration_enable' => ['required', 'boolean'],
            'is_email_verification_enable' => ['required', 'boolean'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function serializeCompanySetting(CompanySetting $companySetting): array
    {
        $companyLogoObject = $companySetting->company_logo
            ? StorageObject::query()->where('object_uuid', $companySetting->company_logo)->first()
            : null;

        return [
            'id' => $companySetting->id,
            'company_name' => $companySetting->company_name,
            'company_details' => $companySetting->company_details,
            'proprietor_name' => $companySetting->proprietor_name,
            'company_address' => $companySetting->company_address,
            'factory_address' => $companySetting->factory_address,
            'company_mobile' => $companySetting->company_mobile,
            'company_phone' => $companySetting->company_phone,
            'company_email' => $companySetting->company_email,
            'trade_license' => $companySetting->trade_license,
            'tin_no' => $companySetting->tin_no,
            'bin_no' => $companySetting->bin_no,
            'vat_no' => $companySetting->vat_no,
            'vat_rate' => $companySetting->vat_rate,
            'currency' => $companySetting->currency,
            'company_logo' => $companySetting->company_logo,
            'company_logo_object' => $companyLogoObject
                ? (new StorageObjectResource($companyLogoObject))->resolve()
                : null,
            'is_registration_enable' => $companySetting->is_registration_enable,
            'is_email_verification_enable' => $companySetting->is_email_verification_enable,
            'status' => $companySetting->status,
            'created_at' => $companySetting->created_at?->toIso8601String(),
            'updated_at' => $companySetting->updated_at?->toIso8601String(),
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
