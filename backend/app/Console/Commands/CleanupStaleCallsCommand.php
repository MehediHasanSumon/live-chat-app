<?php

namespace App\Console\Commands;

use App\Events\Domain\ConversationCallStateChanged;
use App\Events\Domain\ConversationMessageCreated;
use App\Events\Domain\ConversationMessageUpdated;
use App\Http\Resources\CallRoomResource;
use App\Services\Calls\CallService;
use App\Services\Realtime\UserRealtimeSignalService;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CleanupStaleCallsCommand extends Command
{
    protected $signature = 'calls:cleanup-stale';

    protected $description = 'Expire stale calling, ringing, and connecting call rooms.';

    public function handle(
        CallService $callService,
        UserRealtimeSignalService $userRealtimeSignalService,
    ): int {
        $cleanedRooms = $callService->cleanupStaleRooms();

        foreach ($cleanedRooms as $payload) {
            $callRoom = $payload['call_room'];
            $action = $payload['action'];

            Log::warning('calls.stale_room_cleaned', [
                'room_uuid' => $callRoom->room_uuid,
                'conversation_id' => $callRoom->conversation_id,
                'status' => $callRoom->status,
                'action' => $action,
                'ended_reason' => $callRoom->ended_reason,
            ]);

            event(new ConversationCallStateChanged($callRoom, $action));

            $callMessage = $callService->syncCallHistoryMessage($callRoom, $action);

            if ($callMessage['created']) {
                event(new ConversationMessageCreated($callMessage['message']));
            } else {
                event(new ConversationMessageUpdated($callMessage['message']));
            }

            $signalPayload = [
                'action' => $action,
                'call_room' => (new CallRoomResource($callRoom))->resolve(new Request()),
            ];

            foreach ($callRoom->participants->pluck('user_id')->unique() as $userId) {
                $userRealtimeSignalService->dispatchCallSignal((int) $userId, 'call.state.changed', $signalPayload);
            }
        }

        $count = $cleanedRooms->count();

        $this->info("Cleaned up {$count} stale calls.");

        return self::SUCCESS;
    }
}
