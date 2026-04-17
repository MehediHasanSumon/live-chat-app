<?php

namespace App\Http\Controllers;

use App\Models\SmsServiceCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSmsServiceCredentialController extends Controller
{
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
        $credentials = SmsServiceCredential::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('url', 'like', "%{$search}%")
                        ->orWhere('sender_id', 'like', "%{$search}%");
                });
            })
            ->when(! empty($validated['status']), fn ($query) => $query->where('status', $validated['status']))
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $credentials->getCollection()
                ->map(fn (SmsServiceCredential $credential): array => $this->serializeCredential($credential))
                ->values(),
            'meta' => $this->paginationMeta($credentials),
            'links' => $this->paginationLinks($credentials),
        ]);
    }

    public function active(): JsonResponse
    {
        $credential = SmsServiceCredential::query()
            ->where('status', SmsServiceCredential::STATUS_ACTIVE)
            ->latest('id')
            ->first();

        return response()->json([
            'data' => $credential ? $this->serializeCredential($credential) : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $credential = SmsServiceCredential::query()->create($validated);

        return response()->json([
            'data' => $this->serializeCredential($credential->fresh()),
        ], 201);
    }

    public function show(SmsServiceCredential $smsServiceCredential): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeCredential($smsServiceCredential),
        ]);
    }

    public function update(Request $request, SmsServiceCredential $smsServiceCredential): JsonResponse
    {
        $validated = $request->validate($this->rules($smsServiceCredential));

        if (! array_key_exists('api_key', $validated) || $validated['api_key'] === null || $validated['api_key'] === '') {
            unset($validated['api_key']);
        }

        $smsServiceCredential->forceFill($validated)->save();

        return response()->json([
            'data' => $this->serializeCredential($smsServiceCredential->fresh()),
        ]);
    }

    public function destroy(SmsServiceCredential $smsServiceCredential): JsonResponse
    {
        $smsServiceCredential->delete();

        return response()->json([], 204);
    }

    protected function rules(?SmsServiceCredential $credential = null): array
    {
        return [
            'url' => ['required', 'url', 'max:2048'],
            'api_key' => [$credential ? 'nullable' : 'required', 'string', 'max:4000'],
            'sender_id' => ['required', 'string', 'max:120'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ];
    }

    protected function serializeCredential(SmsServiceCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'url' => $credential->url,
            'sender_id' => $credential->sender_id,
            'status' => $credential->status,
            'api_key_present' => filled($credential->api_key),
            'api_key_preview' => $this->apiKeyPreview($credential->api_key),
            'created_at' => $credential->created_at?->toIso8601String(),
            'updated_at' => $credential->updated_at?->toIso8601String(),
        ];
    }

    protected function apiKeyPreview(?string $apiKey): ?string
    {
        if (! $apiKey) {
            return null;
        }

        return str_repeat('*', max(0, strlen($apiKey) - 4)).substr($apiKey, -4);
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
