<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use App\Models\ProductUnit;
use App\Support\ProductUnitCodeHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminProductUnitController extends Controller
{
    use InteractsWithPdfReports;

    public function __construct(private readonly ProductUnitCodeHelper $codeHelper)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $units = ProductUnit::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('unit_name', 'like', "%{$search}%")
                        ->orWhere('unit_value', 'like', "%{$search}%")
                        ->orWhere('unit_code', 'like', "%{$search}%");
                });
            })
            ->orderBy('unit_name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $units->getCollection()->map(fn (ProductUnit $unit): array => $this->serializeUnit($unit))->values(),
            'meta' => $this->paginationMeta($units),
            'links' => $this->paginationLinks($units),
        ]);
    }

    public function options(): JsonResponse
    {
        $units = ProductUnit::query()
            ->orderBy('unit_name')
            ->get()
            ->map(fn (ProductUnit $unit): array => $this->serializeUnit($unit))
            ->values();

        return response()->json(['data' => $units]);
    }

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $units = ProductUnit::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('unit_name', 'like', "%{$search}%")
                        ->orWhere('unit_value', 'like', "%{$search}%")
                        ->orWhere('unit_code', 'like', "%{$search}%");
                });
            })
            ->orderBy('unit_name')
            ->get();

        $rows = $units->values()->map(fn (ProductUnit $unit, int $index): array => [
            (string) ($index + 1),
            $unit->unit_name,
            $unit->unit_value,
            $unit->unit_code,
            $this->pdfDate($unit->updated_at),
        ])->all();

        return $this->downloadTableReportPdf('Product Units List', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Unit Name'],
            ['label' => 'Unit Value', 'width' => '110px'],
            ['label' => 'Unit Code', 'width' => '90px', 'align' => 'center'],
            ['label' => 'Updated', 'width' => '90px', 'align' => 'center'],
        ], $rows, $generatedAt, 'product-units');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $validated['unit_value'] = $this->codeHelper->normalizeSlug($validated['unit_value']);

        $unit = DB::transaction(fn (): ProductUnit => ProductUnit::query()->create([
            ...$validated,
            'unit_code' => $this->codeHelper->generate(),
        ]));

        return response()->json(['data' => $this->serializeUnit($unit)], 201);
    }

    public function update(Request $request, ProductUnit $productUnit): JsonResponse
    {
        $validated = $request->validate($this->rules($productUnit));
        $validated['unit_value'] = $this->codeHelper->normalizeSlug($validated['unit_value']);

        $productUnit->forceFill($validated)->save();

        return response()->json(['data' => $this->serializeUnit($productUnit->fresh())]);
    }

    public function destroy(ProductUnit $productUnit): JsonResponse
    {
        $productUnit->delete();

        return response()->json([], 204);
    }

    protected function rules(?ProductUnit $unit = null): array
    {
        return [
            'unit_name' => ['required', 'string', 'max:60'],
            'unit_value' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9\s._-]+$/'],
        ];
    }

    protected function serializeUnit(ProductUnit $unit): array
    {
        return [
            'id' => $unit->id,
            'unit_name' => $unit->unit_name,
            'unit_value' => $unit->unit_value,
            'unit_code' => $unit->unit_code,
            'created_at' => $unit->created_at?->toIso8601String(),
            'updated_at' => $unit->updated_at?->toIso8601String(),
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
