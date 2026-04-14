<?php

namespace App\Http\Controllers\Concerns;

use App\Support\Access\AdminPermission;

trait AuthorizesStorageAdmin
{
    use AuthorizesAdminAccess;

    protected function authorizeStorageAdmin($request): void
    {
        $this->authorizeAdminAccess($request, AdminPermission::MANAGE_STORAGE);
    }
}
