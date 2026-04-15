<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Auth\VerificationCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class AdminUserController extends Controller
{
    public function __construct(private readonly VerificationCodeService $verificationCodes) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'search' => ['sometimes', 'nullable', 'string', 'max:125'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $search = trim((string) ($validated['search'] ?? ''));
        $users = User::query()
            ->with('roles')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($query) use ($search): void {
                    $query
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $users->getCollection()
                ->map(fn (User $user): array => $this->serializeUser($user))
                ->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'from' => $users->firstItem(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'to' => $users->lastItem(),
                'total' => $users->total(),
            ],
            'links' => [
                'first' => $users->url(1),
                'last' => $users->url($users->lastPage()),
                'prev' => $users->previousPageUrl(),
                'next' => $users->nextPageUrl(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $user = User::query()->create([
            'username' => $this->generateUsername($validated['email']),
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'email_verified_at' => $validated['email_verified'] ? now() : null,
            'password_hash' => $validated['password'],
            'status' => $validated['status'],
        ]);

        $user->syncRoles($validated['roles'] ?? []);

        if ($this->verificationCodes->userMustVerifyEmail($user)) {
            $this->verificationCodes->sendEmailVerificationCode($user);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializeUser($user->fresh('roles')),
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate($this->rules($user));
        $wasVerified = $user->email_verified_at !== null;
        $emailChanged = $user->email !== $validated['email'];

        $attributes = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'email_verified_at' => $validated['email_verified'] ? now() : null,
            'status' => $validated['status'],
        ];

        if (! empty($validated['password'])) {
            $attributes['password_hash'] = $validated['password'];
        }

        $user->forceFill($attributes)->save();
        $user->syncRoles($validated['roles'] ?? []);

        if ($this->verificationCodes->userMustVerifyEmail($user) && ($wasVerified || $emailChanged)) {
            $this->verificationCodes->sendEmailVerificationCode($user);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->serializeUser($user->fresh('roles')),
        ]);
    }

    public function destroy(User $user): JsonResponse
    {
        $user->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([], 204);
    }

    /**
     * @return array<string, mixed>
     */
    protected function rules(?User $user = null): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'email', 'max:120', Rule::unique('users', 'email')->ignore($user?->id)],
            'phone' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($user?->id)],
            'email_verified' => ['required', 'boolean'],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8', 'max:255', 'confirmed'],
            'status' => ['required', Rule::in(['active', 'suspended', 'deleted'])],
            'roles' => ['sometimes', 'array'],
            'roles.*' => ['string', 'exists:roles,name'],
        ];
    }

    protected function generateUsername(string $email): string
    {
        $base = Str::of($email)
            ->before('@')
            ->lower()
            ->replaceMatches('/[^a-z0-9._-]+/', '-')
            ->trim('.-_')
            ->limit(24, '')
            ->toString() ?: 'user';
        $username = $base;
        $suffix = 1;

        while (User::query()->where('username', $username)->exists()) {
            $username = Str::limit($base, 24, '') . '-' . $suffix;
            $suffix++;
        }

        return Str::limit($username, 32, '');
    }

    protected function serializeUser(User $user): array
    {
        $roles = $user->roles
            ->sortBy('name')
            ->map(fn ($role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
            ])
            ->values();

        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
            'status' => $user->status,
            'roles' => $roles,
            'roles_count' => $roles->count(),
            'created_at' => $user->created_at?->toIso8601String(),
            'updated_at' => $user->updated_at?->toIso8601String(),
        ];
    }
}
