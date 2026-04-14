<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\Access\AdminPermission;
use App\Support\Access\AdminRole;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AdminPermission::ALL as $permissionName) {
            Permission::findOrCreate($permissionName, 'web');
        }

        $superAdminRole = Role::findOrCreate(AdminRole::SUPER_ADMIN, 'web');
        $adminRole = Role::findOrCreate(AdminRole::ADMIN, 'web');

        $superAdminRole->syncPermissions(AdminPermission::ALL);
        $adminRole->syncPermissions([
            AdminPermission::VIEW_OPS,
            AdminPermission::MANAGE_STORAGE,
        ]);

        $this->assignRoleFromEnv('INITIAL_SUPER_ADMIN_USERNAMES', $superAdminRole);
        $this->assignRoleFromEnv('INITIAL_ADMIN_USERNAMES', $adminRole);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    protected function assignRoleFromEnv(string $envKey, Role $role): void
    {
        $usernames = collect(explode(',', (string) env($envKey, '')))
            ->map(fn (string $username): string => trim($username))
            ->filter()
            ->values();

        if ($usernames->isEmpty()) {
            return;
        }

        User::query()
            ->whereIn('username', $usernames->all())
            ->get()
            ->each(fn (User $user) => $user->assignRole($role));
    }
}
