<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

trait AuthorizesStorageAdmin
{
    protected function authorizeStorageAdmin(Request $request): void
    {
        if (app()->environment(['local', 'testing'])) {
            return;
        }

        $user = $request->user();

        abort_unless(
            $user
                && method_exists($user, 'hasAnyRole')
                && $user->hasAnyRole(['super-admin', 'admin']),
            403
        );
    }
}
