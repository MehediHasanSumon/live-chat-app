<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCustomerController extends Controller
{
    use InteractsWithPdfReports;

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $customers = Customer::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%")
                        ->orWhere('vehicle_no', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $customers->getCollection()->map(fn (Customer $customer): array => $this->serializeCustomer($customer))->values(),
            'meta' => $this->paginationMeta($customers),
            'links' => $this->paginationLinks($customers),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);

        $search = trim((string) ($validated['search'] ?? ''));
        $customers = Customer::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%")
                        ->orWhere('vehicle_no', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(25)
            ->get()
            ->map(fn (Customer $customer): array => $this->serializeCustomer($customer))
            ->values();

        return response()->json(['data' => $customers]);
    }

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $customers = Customer::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('mobile', 'like', "%{$search}%")
                        ->orWhere('vehicle_no', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        $rows = $customers->values()->map(fn (Customer $customer, int $index): array => [
            (string) ($index + 1),
            $customer->name,
            $this->pdfText($customer->mobile),
            $this->pdfText($customer->vehicle_no),
            $this->pdfDate($customer->updated_at),
        ])->all();

        return $this->downloadTableReportPdf('Customers List', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Name'],
            ['label' => 'Mobile', 'width' => '120px'],
            ['label' => 'Vehicle No', 'width' => '120px'],
            ['label' => 'Updated', 'width' => '90px', 'align' => 'center'],
        ], $rows, $generatedAt, 'customers');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $customer = Customer::query()->create($validated);

        return response()->json(['data' => $this->serializeCustomer($customer)], 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $customer->forceFill($validated)->save();

        return response()->json(['data' => $this->serializeCustomer($customer->fresh())]);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        if ($customer->invoices()->exists()) {
            return response()->json([
                'message' => 'Customer has invoices and cannot be deleted.',
            ], 422);
        }

        $customer->delete();

        return response()->json([], 204);
    }

    protected function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s()]+$/'],
            'vehicle_no' => ['nullable', 'string', 'max:50'],
        ];
    }

    protected function serializeCustomer(Customer $customer): array
    {
        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'mobile' => $customer->mobile,
            'vehicle_no' => $customer->vehicle_no,
            'created_at' => $customer->created_at?->toIso8601String(),
            'updated_at' => $customer->updated_at?->toIso8601String(),
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
