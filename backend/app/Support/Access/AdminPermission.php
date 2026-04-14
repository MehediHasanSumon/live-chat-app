<?php

namespace App\Support\Access;

final class AdminPermission
{
    public const VIEW_OPS = 'admin.ops.view';

    public const MANAGE_STORAGE = 'admin.storage.manage';

    public const ALL = [
        self::VIEW_OPS,
        self::MANAGE_STORAGE,
    ];
}
