<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminRoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $roles = Role::query()
            ->with('permissions')
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
            'data' => $roles->getCollection()
                ->map(fn (Role $role): array => $this->serializeRole($role))
                ->values(),
            'meta' => [
                'current_page' => $roles->currentPage(),
                'from' => $roles->firstItem(),
                'last_page' => $roles->lastPage(),
                'per_page' => $roles->perPage(),
                'to' => $roles->lastItem(),
                'total' => $roles->total(),
            ],
            'links' => [
                'first' => $roles->url(1),
                'last' => $roles->url($roles->lastPage()),
                'prev' => $roles->previousPageUrl(),
                'next' => $roles->nextPageUrl(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:125', 'regex:/^[a-z0-9._-]+$/', Rule::unique('roles', 'name')],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializeRole($role->fresh('permissions')),
        ], 201);
    }

    public function options(): JsonResponse
    {
        $roles = Role::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
            ])
            ->values();

        return response()->json([
            'data' => $roles,
        ]);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:125',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role->forceFill([
            'name' => $validated['name'],
        ])->save();
        $role->syncPermissions($validated['permissions'] ?? []);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializeRole($role->fresh('permissions')),
        ]);
    }

    public function destroy(Role $role): JsonResponse
    {
        $role->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([], 204);
    }

    protected function serializeRole(Role $role): array
    {
        $permissions = $role->permissions
            ->sortBy('name')
            ->map(fn ($permission): array => [
                'id' => $permission->id,
                'name' => $permission->name,
                'guard_name' => $permission->guard_name,
            ])
            ->values();

        return [
            'id' => $role->id,
            'name' => $role->name,
            'guard_name' => $role->guard_name,
            'permissions' => $permissions,
            'permissions_count' => $permissions->count(),
            'created_at' => $role->created_at?->toIso8601String(),
            'updated_at' => $role->updated_at?->toIso8601String(),
        ];
    }
}
