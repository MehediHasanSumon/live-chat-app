<?php

namespace App\Http\Controllers;

use App\Models\ProductPrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdminProductPriceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $prices = ProductPrice::query()
            ->with(['product', 'unit', 'creator'])
            ->when($search !== '', function ($query) use ($search): void {
                $query->whereHas('product', function ($query) use ($search): void {
                    $query
                        ->where('product_name', 'like', "%{$search}%")
                        ->orWhere('product_code', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['product_id']), fn ($query) => $query->where('product_id', $validated['product_id']))
            ->when(array_key_exists('is_active', $validated), fn ($query) => $query->where('is_active', $validated['is_active']))
            ->orderByDesc('date_time')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $prices->getCollection()->map(fn (ProductPrice $price): array => $this->serializePrice($price))->values(),
            'meta' => $this->paginationMeta($prices),
            'links' => $this->paginationLinks($prices),
        ]);
    }

    public function activeOptions(): JsonResponse
    {
        $prices = ProductPrice::query()
            ->with(['product', 'unit'])
            ->where('is_active', true)
            ->whereHas('product', fn ($query) => $query->where('status', 'active'))
            ->orderBy(
                \App\Models\Product::query()
                    ->select('product_name')
                    ->whereColumn('products.id', 'product_prices.product_id')
                    ->limit(1)
            )
            ->get()
            ->map(fn (ProductPrice $price): array => $this->serializePrice($price))
            ->values();

        return response()->json(['data' => $prices]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $price = DB::transaction(function () use ($validated, $request): ProductPrice {
            if ((bool) $validated['is_active']) {
                $this->deactivateOtherPrices((int) $validated['product_id']);
            }

            return ProductPrice::query()->create([
                'product_id' => $validated['product_id'],
                'product_unit_id' => $validated['product_unit_id'] ?? null,
                'original_price' => $validated['original_price'],
                'sell_price' => $validated['sell_price'],
                'date_time' => $this->normalizeDateTime($validated['date_time']),
                'is_active' => (bool) $validated['is_active'],
                'created_by' => $request->user()?->id,
                'deactivated_at' => (bool) $validated['is_active'] ? null : ($validated['deactivated_at'] ?? null),
                'note' => $validated['note'] ?? null,
            ]);
        });

        return response()->json([
            'data' => $this->serializePrice($price->fresh(['product', 'unit', 'creator'])),
        ], 201);
    }

    public function update(Request $request, ProductPrice $productPrice): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $price = DB::transaction(function () use ($validated, $productPrice): ProductPrice {
            if ((bool) $validated['is_active']) {
                $this->deactivateOtherPrices((int) $validated['product_id'], $productPrice->id);
            }

            $productPrice->forceFill([
                'product_id' => $validated['product_id'],
                'product_unit_id' => $validated['product_unit_id'] ?? null,
                'original_price' => $validated['original_price'],
                'sell_price' => $validated['sell_price'],
                'date_time' => $this->normalizeDateTime($validated['date_time']),
                'is_active' => (bool) $validated['is_active'],
                'deactivated_at' => (bool) $validated['is_active'] ? null : ($validated['deactivated_at'] ?? now()),
                'note' => $validated['note'] ?? null,
            ])->save();

            return $productPrice;
        });

        return response()->json([
            'data' => $this->serializePrice($price->fresh(['product', 'unit', 'creator'])),
        ]);
    }

    public function destroy(ProductPrice $productPrice): JsonResponse
    {
        $productPrice->delete();

        return response()->json([], 204);
    }

    protected function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'original_price' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'sell_price' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'date_time' => ['required', 'date'],
            'is_active' => ['required', 'boolean'],
            'deactivated_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    protected function deactivateOtherPrices(int $productId, ?int $exceptId = null): void
    {
        ProductPrice::query()
            ->where('product_id', $productId)
            ->where('is_active', true)
            ->when($exceptId, fn ($query) => $query->whereKeyNot($exceptId))
            ->update([
                'is_active' => false,
                'deactivated_at' => now(),
            ]);
    }

    protected function normalizeDateTime(string $value): Carbon
    {
        $dateTime = Carbon::parse($value);

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            $now = now();

            return $dateTime->setTime((int) $now->format('H'), (int) $now->format('i'), (int) $now->format('s'));
        }

        return $dateTime;
    }

    protected function serializePrice(ProductPrice $price): array
    {
        return [
            'id' => $price->id,
            'product_id' => $price->product_id,
            'product' => $price->product ? [
                'id' => $price->product->id,
                'product_name' => $price->product->product_name,
                'product_code' => $price->product->product_code,
                'status' => $price->product->status,
            ] : null,
            'product_unit_id' => $price->product_unit_id,
            'unit' => $price->unit ? [
                'id' => $price->unit->id,
                'unit_name' => $price->unit->unit_name,
                'unit_value' => $price->unit->unit_value,
                'unit_code' => $price->unit->unit_code,
            ] : null,
            'original_price' => $price->original_price,
            'sell_price' => $price->sell_price,
            'date_time' => $price->date_time?->toIso8601String(),
            'is_active' => $price->is_active,
            'created_by' => $price->created_by,
            'creator' => $price->creator ? [
                'id' => $price->creator->id,
                'name' => $price->creator->name,
            ] : null,
            'deactivated_at' => $price->deactivated_at?->toIso8601String(),
            'note' => $price->note,
            'created_at' => $price->created_at?->toIso8601String(),
            'updated_at' => $price->updated_at?->toIso8601String(),
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
