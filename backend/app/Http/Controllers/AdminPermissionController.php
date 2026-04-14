<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class AdminPermissionController extends Controller
{
    public function index(): JsonResponse
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
