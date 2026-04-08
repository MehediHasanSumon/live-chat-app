<?php

namespace App\Http\Controllers;

use App\Http\Requests\Conversation\AddGroupMembersRequest;
use App\Http\Requests\Conversation\ChangeGroupMemberRoleRequest;
use App\Http\Requests\Conversation\StoreGroupConversationRequest;
use App\Http\Requests\Conversation\UpdateGroupConversationRequest;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Conversations\ConversationMemberService;
use App\Services\Conversations\ConversationService;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;

class GroupController extends Controller
{
    public function __construct(
        protected ConversationService $conversationService,
        protected ConversationMemberService $conversationMemberService,
    ) {
    }

    public function store(StoreGroupConversationRequest $request): JsonResponse
    {
        try {
            $conversation = $this->conversationService->createGroup(
                $request->user()->getKey(),
                $request->array('member_ids'),
                $request->validated()
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'member_ids' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => new ConversationResource($conversation),
        ], 201);
    }

    public function update(UpdateGroupConversationRequest $request, Conversation $conversation): JsonResponse
    {
        abort_unless($request->user()->can('manageGroup', $conversation), 403);

        return response()->json([
            'data' => new ConversationResource(
                $this->conversationService->updateGroup(
                    $conversation,
                    $request->user()->getKey(),
                    $request->validated()
                )
            ),
        ]);
    }

    public function addMembers(AddGroupMembersRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $conversation = $this->conversationMemberService->addMembers(
                $conversation,
                $request->array('member_ids'),
                $request->user()->getKey(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'member_ids' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function removeMember(Conversation $conversation, User $user): JsonResponse
    {
        try {
            $conversation = $this->conversationMemberService->removeMember(
                $conversation,
                $user->getKey(),
                request()->user()->getKey(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'user' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve(request()),
        ]);
    }

    public function changeRole(
        ChangeGroupMemberRoleRequest $request,
        Conversation $conversation,
        User $user,
    ): JsonResponse {
        try {
            $conversation = $this->conversationMemberService->changeRole(
                $conversation,
                $user->getKey(),
                $request->string('role')->toString(),
                $request->user()->getKey(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'role' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve($request),
        ]);
    }

    public function leave(Conversation $conversation): JsonResponse
    {
        try {
            $conversation = $this->conversationMemberService->leaveGroup(
                $conversation,
                request()->user()->getKey(),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'conversation' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new ConversationResource($conversation))->resolve(request()),
        ]);
    }
}
