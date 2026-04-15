<?php

namespace App\Services\Notifications;

use App\Jobs\DeliverNotificationOutboxJob;
use App\Models\CallRoom;
use App\Models\CallRoomParticipant;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\NotificationOutbox;
use App\Models\UserBlock;
use App\Models\UserDevice;
use App\Models\UserRestriction;
use App\Models\UserSetting;
use App\Services\Realtime\UserRealtimeSignalService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NotificationService
{
    public function __construct(
        protected UserRealtimeSignalService $userRealtimeSignalService,
    ) {
    }

    public function queueMessagePush(Message $message): void
    {
        $message->loadMissing(['conversation.members', 'sender']);

        $message->conversation->members
            ->filter(fn (ConversationMember $membership): bool => $membership->user_id !== $message->sender_id)
            ->each(function (ConversationMember $membership) use ($message): void {
                if ($membership->membership_state === 'request_pending') {
                    $notification = $this->createOutboxEntry(
                        userId: (int) $membership->user_id,
                        type: 'request',
                        provider: $this->resolveProvider((int) $membership->user_id),
                        title: $message->sender?->name ?: 'New message request',
                        body: 'Sent you a message request.',
                        conversationId: (int) $message->conversation_id,
                        payload: [
                            'event_name' => 'conversation.request.created',
                            'message_id' => $message->getKey(),
                            'conversation_id' => (int) $message->conversation_id,
                            'sender_id' => (int) $message->sender_id,
                            'type' => 'request',
                        ],
                    );

                    $this->dispatchQueuedOutbox($notification);

                    return;
                }

                $scheduleAt = $this->resolveScheduleAt($membership);
                $isSuppressed = $this->shouldSuppressPush(
                    (int) $membership->user_id,
                    (int) $message->conversation_id,
                    (int) $message->sender_id,
                );

                if ($scheduleAt) {
                    $this->queueScheduledDigest($membership, $message, $scheduleAt);

                    return;
                }

                $notification = $this->createOutboxEntry(
                    userId: (int) $membership->user_id,
                    type: 'new_message',
                    provider: $this->resolveProvider((int) $membership->user_id),
                    title: $message->sender?->name ?: 'New message',
                    body: $this->messageBodyPreview($message),
                    conversationId: (int) $message->conversation_id,
                    payload: [
                        'event_name' => 'notification.badge.updated',
                        'message_id' => $message->getKey(),
                        'conversation_id' => (int) $message->conversation_id,
                        'sender_id' => (int) $message->sender_id,
                        'type' => 'new_message',
                    ],
                    status: $isSuppressed ? 'suppressed' : 'queued',
                    failureReason: $isSuppressed ? 'muted_or_restricted' : null,
                );

                if (! $isSuppressed) {
                    $this->dispatchQueuedOutbox($notification);
                }
            });
    }

    /**
     * @param  array<int>  $notifyUserIds
     */
    public function queueCallInvite(CallRoom $callRoom, array $notifyUserIds): void
    {
        foreach (collect($notifyUserIds)->map(fn ($id) => (int) $id)->unique() as $userId) {
            $deliveryProfile = $this->resolveDeliveryProfile($userId);
            $isSuppressed = $this->shouldSuppressPush(
                $userId,
                (int) $callRoom->conversation_id,
                (int) $callRoom->created_by,
            );
            $isBusy = $this->hasAnotherActiveCall($userId, $callRoom->room_uuid);
            $notificationStatus = $isSuppressed || ! $deliveryProfile['push_enabled'] ? 'suppressed' : 'queued';
            $failureReason = ! $deliveryProfile['push_enabled']
                ? 'push_disabled'
                : ($isSuppressed ? 'muted_or_restricted' : null);

            $notification = $this->createOutboxEntry(
                userId: $userId,
                type: 'call_invite',
                provider: $this->resolveProvider($userId),
                title: 'Incoming '.($callRoom->media_type === 'video' ? 'video' : 'voice').' call',
                body: $isBusy
                    ? 'Incoming call while you are already in another live call.'
                    : 'Join the call in conversation #'.$callRoom->conversation_id.'.',
                conversationId: (int) $callRoom->conversation_id,
                payload: [
                    'event_name' => 'call.incoming',
                    'call_room_uuid' => $callRoom->room_uuid,
                    'conversation_id' => (int) $callRoom->conversation_id,
                    'type' => 'call_invite',
                    'silent' => $deliveryProfile['silent'],
                    'busy' => $isBusy,
                    'can_accept' => true,
                ],
                status: $notificationStatus,
                failureReason: $failureReason,
            );

            Log::info('notifications.call_invite_queued', [
                'user_id' => $userId,
                'room_uuid' => $callRoom->room_uuid,
                'conversation_id' => (int) $callRoom->conversation_id,
                'silent' => $deliveryProfile['silent'],
                'busy' => $isBusy,
                'status' => $notification->status,
                'failure_reason' => $notification->failure_reason,
            ]);

            if ($notificationStatus === 'queued') {
                $this->dispatchQueuedOutbox($notification);
            }
        }
    }

    public function deliverOutbox(NotificationOutbox $notification): NotificationOutbox
    {
        if ($notification->status !== 'queued') {
            return $notification;
        }

        if ($notification->schedule_at && $notification->schedule_at->isFuture()) {
            return $notification;
        }

        $eventName = $notification->payload_json['event_name'] ?? 'notification.badge.updated';

        $badgeCount = NotificationOutbox::query()
            ->where('user_id', $notification->user_id)
            ->whereIn('status', ['queued', 'sent'])
            ->count();

        $payload = array_merge($notification->payload_json ?? [], [
            'notification_id' => $notification->getKey(),
            'title' => $notification->title,
            'body' => $notification->body,
            'badge_count' => $badgeCount,
            'provider' => $notification->provider,
        ]);

        $notification->forceFill([
            'status' => 'sent',
            'sent_at' => now(),
            'failure_reason' => null,
        ])->save();

        $this->userRealtimeSignalService->dispatchNotification(
            (int) $notification->user_id,
            (string) $eventName,
            $payload,
        );

        return $notification->fresh();
    }

    public function dispatchScheduledDigests(): int
    {
        return DB::transaction(function (): int {
            $dueNotifications = NotificationOutbox::query()
                ->where('type', 'summary')
                ->where('status', 'queued')
                ->whereNotNull('schedule_at')
                ->where('schedule_at', '<=', now())
                ->lockForUpdate()
                ->get();

            foreach ($dueNotifications as $notification) {
                DeliverNotificationOutboxJob::dispatch($notification->getKey());
            }

            return $dueNotifications->count();
        });
    }

    public function shouldSuppressPush(int $userId, ?int $conversationId = null, ?int $senderId = null): bool
    {
        if ($senderId !== null && $senderId === $userId) {
            return true;
        }

        $settings = UserSetting::query()->where('user_id', $userId)->first();

        if ($settings && ! $settings->push_enabled) {
            return true;
        }

        if ($conversationId !== null) {
            $membership = ConversationMember::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $userId)
                ->first();

            if ($membership) {
                if ($membership->notifications_mode === 'mute') {
                    return true;
                }

                if ($membership->muted_until?->isFuture()) {
                    return true;
                }
            }
        }

        if ($senderId === null) {
            return false;
        }

        if (UserRestriction::query()
            ->where('owner_user_id', $userId)
            ->where('target_user_id', $senderId)
            ->where('mute_notifications', true)
            ->exists()) {
            return true;
        }

        return UserBlock::query()
            ->where('blocker_user_id', $userId)
            ->where('blocked_user_id', $senderId)
            ->exists();
    }

    /**
     * @return array{push_enabled: bool, silent: bool}
     */
    protected function resolveDeliveryProfile(int $userId): array
    {
        $settings = UserSetting::query()->where('user_id', $userId)->first();

        if (! $settings) {
            return [
                'push_enabled' => true,
                'silent' => false,
            ];
        }

        return [
            'push_enabled' => (bool) $settings->push_enabled,
            'silent' => ! $settings->sound_enabled || $this->isQuietHoursActive($settings),
        ];
    }

    protected function isQuietHoursActive(UserSetting $settings): bool
    {
        if (! $settings->quiet_hours_enabled || ! $settings->quiet_hours_start || ! $settings->quiet_hours_end) {
            return false;
        }

        $timezone = $settings->quiet_hours_timezone ?: config('app.timezone');
        $now = now($timezone);
        [$startHour, $startMinute] = array_map('intval', explode(':', (string) $settings->quiet_hours_start));
        [$endHour, $endMinute] = array_map('intval', explode(':', (string) $settings->quiet_hours_end));
        $start = $now->copy()->setTime($startHour, $startMinute);
        $end = $now->copy()->setTime($endHour, $endMinute);

        if ($end->lessThanOrEqualTo($start)) {
            return $now->greaterThanOrEqualTo($start) || $now->lessThanOrEqualTo($end);
        }

        return $now->betweenIncluded($start, $end);
    }

    protected function hasAnotherActiveCall(int $userId, string $currentRoomUuid): bool
    {
        return CallRoomParticipant::query()
            ->where('user_id', $userId)
            ->where('invite_status', 'accepted')
            ->whereHas('callRoom', function ($query) use ($currentRoomUuid): void {
                $query
                    ->whereIn('status', CallRoom::ACTIVE_STATUSES)
                    ->where('room_uuid', '!=', $currentRoomUuid);
            })
            ->exists();
    }

    protected function queueScheduledDigest(ConversationMember $membership, Message $message, Carbon $scheduleAt): void
    {
        $notification = NotificationOutbox::query()->updateOrCreate([
            'user_id' => (int) $membership->user_id,
            'conversation_id' => (int) $message->conversation_id,
            'type' => 'summary',
            'status' => 'queued',
        ], [
            'provider' => $this->resolveProvider((int) $membership->user_id),
            'title' => 'Scheduled message summary',
            'body' => 'You have unread activity waiting.',
            'payload_json' => [
                'event_name' => 'notification.badge.updated',
                'conversation_id' => (int) $message->conversation_id,
                'message_id' => $message->getKey(),
                'sender_id' => (int) $message->sender_id,
                'type' => 'summary',
            ],
            'schedule_at' => $scheduleAt,
            'failure_reason' => null,
        ]);

        if ($notification->schedule_at && $notification->schedule_at->lte(now())) {
            $this->dispatchQueuedOutbox($notification);
        }
    }

    protected function resolveScheduleAt(ConversationMember $membership): ?Carbon
    {
        if ($membership->notifications_mode !== 'scheduled') {
            return null;
        }

        $schedule = $membership->notification_schedule_json ?? [];
        $hour = (int) ($schedule['hour'] ?? 9);
        $minute = (int) ($schedule['minute'] ?? 0);
        $timezone = (string) ($schedule['timezone'] ?? config('app.timezone'));

        $nextRun = now($timezone)->setTime($hour, $minute);

        if ($nextRun->lte(now($timezone))) {
            $nextRun = $nextRun->addDay();
        }

        return $nextRun->setTimezone(config('app.timezone'));
    }

    protected function dispatchQueuedOutbox(NotificationOutbox $notification): void
    {
        if ($notification->status !== 'queued') {
            return;
        }

        DeliverNotificationOutboxJob::dispatch($notification->getKey());
    }

    protected function createOutboxEntry(
        int $userId,
        string $type,
        string $provider,
        string $title,
        string $body,
        ?int $conversationId = null,
        ?array $payload = null,
        string $status = 'queued',
        ?string $failureReason = null,
    ): NotificationOutbox {
        return NotificationOutbox::query()->create([
            'user_id' => $userId,
            'conversation_id' => $conversationId,
            'type' => $type,
            'title' => Str::limit($title, 160, ''),
            'body' => Str::limit($body, 255, ''),
            'payload_json' => $payload,
            'provider' => $provider,
            'status' => $status,
            'failure_reason' => $failureReason,
        ]);
    }

    protected function resolveProvider(int $userId): string
    {
        $deviceProvider = UserDevice::query()
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->whereIn('push_provider', ['fcm', 'apns', 'webpush'])
            ->orderByDesc('last_seen_at')
            ->value('push_provider');

        return $deviceProvider ?: 'websocket';
    }

    protected function messageBodyPreview(Message $message): string
    {
        return match ($message->type) {
            'text' => Str::limit((string) $message->text_body, 255),
            'image' => 'Sent a photo',
            'video' => 'Sent a video',
            'voice' => 'Sent a voice message',
            'file' => 'Sent a file',
            'gif' => 'Sent a GIF',
            default => 'Sent a message',
        };
    }
}
