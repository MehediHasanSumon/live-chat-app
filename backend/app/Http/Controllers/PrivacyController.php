<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConversationResource;
use App\Http\Resources\UserBlockResource;
use App\Http\Resources\UserRestrictionResource;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Privacy\PrivacyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class PrivacyController extends Controller
{
    public function __construct(
        protected PrivacyService $privacyService,
    ) {
    }

    public function messageRequests(Request $request): JsonResponse
    {
        return response()->json([
            'data' => ConversationResource::collection(
                $this->privacyService->listMessageRequests($request->user()->getKey())
            )->resolve(),
        ]);
    }

    public function acceptMessageRequest(Request $request, Conversation $conversation): JsonResponse
    {
        try {
            $conversation = $this->privacyService->acceptMessageRequest($conversation, $request->user()->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'conversation' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function rejectMessageRequest(Request $request, Conversation $conversation): JsonResponse
    {
        try {
            $conversation = $this->privacyService->rejectMessageRequest($conversation, $request->user()->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'conversation' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function block(Request $request, User $user): JsonResponse
    {
        try {
            $block = $this->privacyService->blockUser($request->user()->getKey(), $user->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'user' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new UserBlockResource($block))->resolve($request),
        ], 201);
    }

    public function unblock(Request $request, User $user): JsonResponse
    {
        $deleted = $this->privacyService->unblockUser($request->user()->getKey(), $user->getKey());

        return response()->json([
            'data' => [
                'blocked_user_id' => $user->getKey(),
                'deleted' => $deleted,
            ],
        ]);
    }

    public function restrict(Request $request, User $user): JsonResponse
    {
        try {
            $restriction = $this->privacyService->restrictUser($request->user()->getKey(), $user->getKey());
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'user' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new UserRestrictionResource($restriction))->resolve($request),
        ], 201);
    }

    public function unrestrict(Request $request, User $user): JsonResponse
    {
        $deleted = $this->privacyService->unrestrictUser($request->user()->getKey(), $user->getKey());

        return response()->json([
            'data' => [
                'target_user_id' => $user->getKey(),
                'deleted' => $deleted,
            ],
        ]);
    }

    public function presence(Request $request, User $user): JsonResponse
    {
        return response()->json([
            'data' => $this->privacyService->resolvePresenceVisibility(
                $request->user()->getKey(),
                $user,
            ),
        ]);
    }
}
