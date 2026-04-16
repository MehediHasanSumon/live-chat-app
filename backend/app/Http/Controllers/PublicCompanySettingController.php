<?php

namespace App\Http\Controllers;

use App\Services\Company\PublicCompanySettingService;
use Illuminate\Http\JsonResponse;

class PublicCompanySettingController extends Controller
{
    public function __invoke(PublicCompanySettingService $publicCompanySettings): JsonResponse
    {
        return response()->json([
            'data' => $publicCompanySettings->publicPayload(),
        ]);
    }
}
