<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\InteractsWithPdfReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class AdminPermissionController extends Controller
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
        $permissions = Permission::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('guard_name', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $permissions->getCollection()
                ->map(fn (Permission $permission): array => $this->serializePermission($permission))
                ->values(),
            'meta' => [
                'current_page' => $permissions->currentPage(),
                'from' => $permissions->firstItem(),
                'last_page' => $permissions->lastPage(),
                'per_page' => $permissions->perPage(),
                'to' => $permissions->lastItem(),
                'total' => $permissions->total(),
            ],
            'links' => [
                'first' => $permissions->url(1),
                'last' => $permissions->url($permissions->lastPage()),
                'prev' => $permissions->previousPageUrl(),
                'next' => $permissions->nextPageUrl(),
            ],
        ]);
    }

    public function exportPdf(Request $request)
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);
        $search = trim((string) ($validated['search'] ?? ''));
        $generatedAt = now();
        $permissions = Permission::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('guard_name', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        $rows = $permissions->values()->map(fn (Permission $permission, int $index): array => [
            (string) ($index + 1),
            $permission->name,
            $permission->guard_name,
            $this->pdfDate($permission->updated_at),
        ])->all();

        return $this->downloadTableReportPdf('Permissions List', [
            ['label' => 'SL', 'width' => '48px', 'align' => 'center'],
            ['label' => 'Name'],
            ['label' => 'Guard', 'width' => '90px'],
            ['label' => 'Updated', 'width' => '90px', 'align' => 'center'],
        ], $rows, $generatedAt, 'permissions');
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:125', 'regex:/^[a-z0-9._-]+$/', 'unique:permissions,name'],
        ]);

        $permission = Permission::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializePermission($permission),
        ], 201);
    }

    public function options(): JsonResponse
    {
        $permissions = Permission::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Permission $permission): array => $this->serializePermission($permission))
            ->values();

        return response()->json([
            'data' => $permissions,
        ]);
    }

    public function update(Request $request, Permission $permission): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:125',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique('permissions', 'name')->ignore($permission->id),
            ],
        ]);

        $permission->forceFill([
            'name' => $validated['name'],
        ])->save();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializePermission($permission->fresh()),
        ]);
    }

    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([], 204);
    }

    protected function serializePermission(Permission $permission): array
    {
        return [
            'id' => $permission->id,
            'name' => $permission->name,
            'guard_name' => $permission->guard_name,
            'created_at' => $permission->created_at?->toIso8601String(),
            'updated_at' => $permission->updated_at?->toIso8601String(),
        ];
    }
}
