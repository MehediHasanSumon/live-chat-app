<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesAdminAccess;
use App\Services\Ops\AdminOpsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminOpsController extends Controller
{
    use AuthorizesAdminAccess;

    public function __construct(
        protected AdminOpsService $adminOpsService,
    ) {
    }

    public function health(Request $request): JsonResponse
    {
        $this->authorizeAdminAccess($request);

        return response()->json([
            'data' => $this->adminOpsService->health(),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $this->authorizeAdminAccess($request);

        return response()->json([
            'data' => $this->adminOpsService->status(),
        ]);
    }
}
