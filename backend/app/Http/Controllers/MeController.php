<?php

namespace App\Http\Controllers;

use App\Http\Resources\Auth\AuthenticatedUserResource;
use App\Models\UserSetting;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __invoke(Request $request): AuthenticatedUserResource
    {
        $user = $request->user();

        UserSetting::query()->firstOrCreate(
            ['user_id' => $user->getKey()],
            ['updated_at' => now()]
        );

        $user->forceFill([
            'last_seen_at' => now(),
        ])->save();

        return new AuthenticatedUserResource($user->fresh(['settings']));
    }
}
