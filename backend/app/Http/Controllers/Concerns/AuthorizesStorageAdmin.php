<?php

namespace App\Http\Controllers\Concerns;

trait AuthorizesStorageAdmin
{
    use AuthorizesAdminAccess;

    protected function authorizeStorageAdmin($request): void
    {
        $this->authorizeAdminAccess($request);
    }
}
