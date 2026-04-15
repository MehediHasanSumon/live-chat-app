<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Support\ProductCodeHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminProductController extends Controller
{
    public function __construct(private readonly ProductCodeHelper $codeHelper)
    {
    }

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
        $products = Product::query()
            ->with('activePrice.unit')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('product_name', 'like', "%{$search}%")
                        ->orWhere('product_code', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderBy('product_name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $products->getCollection()->map(fn (Product $product): array => $this->serializeProduct($product))->values(),
            'meta' => $this->paginationMeta($products),
            'links' => $this->paginationLinks($products),
        ]);
    }

    public function options(): JsonResponse
    {
        $products = Product::query()
            ->with('activePrice.unit')
            ->where('status', 'active')
            ->orderBy('product_name')
            ->get()
            ->map(fn (Product $product): array => $this->serializeProduct($product))
            ->values();

        return response()->json(['data' => $products]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $product = DB::transaction(fn (): Product => Product::query()->create([
            ...$validated,
            'product_code' => $this->codeHelper->generate(),
        ]));

        return response()->json([
            'data' => $this->serializeProduct($product->fresh('activePrice.unit')),
        ], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate($this->rules($product));

        $product->forceFill($validated)->save();

        return response()->json([
            'data' => $this->serializeProduct($product->fresh('activePrice.unit')),
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json([], 204);
    }

    protected function rules(?Product $product = null): array
    {
        return [
            'product_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function serializeProduct(Product $product): array
    {
        return [
            'id' => $product->id,
            'product_name' => $product->product_name,
            'product_code' => $product->product_code,
            'description' => $product->description,
            'status' => $product->status,
            'active_price' => $product->activePrice ? [
                'id' => $product->activePrice->id,
                'original_price' => $product->activePrice->original_price,
                'sell_price' => $product->activePrice->sell_price,
                'date_time' => $product->activePrice->date_time?->toIso8601String(),
                'unit' => $product->activePrice->unit ? [
                    'id' => $product->activePrice->unit->id,
                    'unit_name' => $product->activePrice->unit->unit_name,
                    'unit_value' => $product->activePrice->unit->unit_value,
                    'unit_code' => $product->activePrice->unit->unit_code,
                ] : null,
            ] : null,
            'created_at' => $product->created_at?->toIso8601String(),
            'updated_at' => $product->updated_at?->toIso8601String(),
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
