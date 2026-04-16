<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserDirectoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('query', ''));
        $users = User::query()
            ->where('id', '!=', $request->user()->getKey())
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($nestedBuilder) use ($query): void {
                    $nestedBuilder
                        ->where('name', 'like', "%{$query}%")
                        ->orWhere('username', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%");
                });
            })
            ->orderBy('name')
            ->limit($query === '' ? 30 : 10)
            ->with('avatarObject')
            ->get();

        return response()->json([
            'data' => UserResource::collection($users)->resolve($request),
        ]);
    }
}
