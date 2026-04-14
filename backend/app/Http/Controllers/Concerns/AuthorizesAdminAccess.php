<?php

namespace App\Http\Controllers\Concerns;

use App\Support\Access\AdminPermission;
use Illuminate\Http\Request;

trait AuthorizesAdminAccess
{
    protected function authorizeAdminAccess(Request $request, string|array|null $permissions = null): void
    {
        if (app()->environment(['local'])) {
            return;
        }

        $user = $request->user();
        $requiredPermissions = collect((array) ($permissions ?? AdminPermission::VIEW_OPS))
            ->filter()
            ->values()
            ->all();

        abort_unless(
            $user
                && method_exists($user, 'canAny')
                && $user->canAny($requiredPermissions),
            403
        );
    }
}
