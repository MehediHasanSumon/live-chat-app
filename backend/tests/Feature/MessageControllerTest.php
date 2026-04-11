<?php

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\MessageEdit;
use App\Models\MessageHiddenForUser;
use App\Models\MessageReaction;
use App\Models\UserBlock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function createDirectConversationWithMembers(User $leftUser, User $rightUser): Conversation
{
    $conversation = Conversation::query()->create([
        'type' => 'direct',
        'direct_key' => hash('sha256', implode(':', collect([$leftUser->id, $rightUser->id])->sort()->values()->all())),
        'created_by' => $leftUser->id,
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $leftUser->id,
        'role' => 'owner',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    ConversationMember::query()->create([
        'conversation_id' => $conversation->id,
        'user_id' => $rightUser->id,
        'role' => 'member',
        'membership_state' => 'active',
        'joined_at' => now(),
    ]);

    return $conversation;
}

it('sends text messages with seq ordering and client uuid idempotency', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);
    $clientUuid = (string) str()->uuid();

    $response = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Hello from Laravel chat',
            'client_uuid' => $clientUuid,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.seq', 1)
        ->assertJsonPath('data.text_body', 'Hello from Laravel chat');

    $messageId = $response->json('data.id');

    expect(Message::query()->count())->toBe(1)
        ->and(Conversation::query()->find($conversation->id)->last_message_preview)->toBe('Hello from Laravel chat')
        ->and(
            ConversationMember::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $recipient->id)
                ->value('unread_count_cache')
        )->toBe(1);

    $duplicateResponse = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Hello from Laravel chat',
            'client_uuid' => $clientUuid,
        ]);

    $duplicateResponse
        ->assertOk()
        ->assertJsonPath('data.id', $messageId);

    expect(Message::query()->count())->toBe(1);
});

it('restores archived conversations for recipients when a new message arrives', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    ConversationMember::query()
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $recipient->id)
        ->update([
            'archived_at' => now()->subHour(),
            'unread_count_cache' => 0,
        ]);

    $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Wake this chat back up',
        ])
        ->assertCreated();

    $recipientMembership = ConversationMember::query()
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $recipient->id)
        ->first();

    expect($recipientMembership?->archived_at)->toBeNull()
        ->and($recipientMembership?->unread_count_cache)->toBe(1);
});

it('stores reply quote snapshots and returns messages in seq order', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $original = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $recipient->id,
        'type' => 'text',
        'text_body' => 'Original note',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $conversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $original->id,
        'last_message_preview' => 'Original note',
        'last_message_at' => $original->created_at,
    ])->save();

    $response = $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/text", [
            'text' => 'Replying now',
            'reply_to_message_id' => $original->id,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.reply_to_message_id', $original->id)
        ->assertJsonPath('data.quote_snapshot_json.message_id', $original->id)
        ->assertJsonPath('data.quote_snapshot_json.text_body', 'Original note');

    $listResponse = $this->actingAs($sender, 'web')
        ->getJson("/api/conversations/{$conversation->id}/messages");

    $listResponse
        ->assertOk()
        ->assertJsonPath('data.0.seq', 1)
        ->assertJsonPath('data.1.seq', 2);
});

it('edits a text message inside the edit window and updates preview', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Draft message',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $conversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $message->id,
        'last_message_preview' => 'Draft message',
        'last_message_at' => $message->created_at,
    ])->save();

    $response = $this->actingAs($sender, 'web')
        ->patchJson("/api/messages/{$message->id}", [
            'text' => 'Edited final message',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.text_body', 'Edited final message')
        ->assertJsonPath('data.is_edited', true);

    expect(MessageEdit::query()->where('message_id', $message->id)->count())->toBe(1)
        ->and(Conversation::query()->find($conversation->id)->last_message_preview)->toBe('Edited final message');
});

it('rejects edits after the edit window expires', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Too late',
        'editable_until_at' => now()->subMinute(),
    ]);

    $response = $this->actingAs($sender, 'web')
        ->patchJson("/api/messages/{$message->id}", [
            'text' => 'Should fail',
        ]);

    $response
        ->assertStatus(422)
        ->assertJsonPath('errors.text.0', 'The edit window has expired for this message.');
});

it('supports delete for self and hides the message from that user listing', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Temporary note',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $conversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $message->id,
        'last_message_preview' => 'Temporary note',
        'last_message_at' => $message->created_at,
    ])->save();

    $this->actingAs($recipient, 'web');

    $deleteForSelfResponse = $this->deleteJson("/api/messages/{$message->id}", [
        'scope' => 'self',
    ]);

    $deleteForSelfResponse
        ->assertOk()
        ->assertJsonPath('data.scope', 'self');

    expect(MessageHiddenForUser::query()->where('message_id', $message->id)->where('user_id', $recipient->id)->exists())->toBeTrue();

    $hiddenListResponse = $this->getJson("/api/conversations/{$conversation->id}/messages");

    $hiddenListResponse
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('supports unsend for everyone and updates conversation preview plus unread counts', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Temporary note',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $conversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $message->id,
        'last_message_preview' => 'Temporary note',
        'last_message_at' => $message->created_at,
    ])->save();

    ConversationMember::query()
        ->where('conversation_id', $conversation->id)
        ->where('user_id', $recipient->id)
        ->update([
            'unread_count_cache' => 1,
        ]);

    $this->actingAs($sender, 'web');

    $unsendResponse = $this->deleteJson("/api/messages/{$message->id}", [
        'scope' => 'everyone',
    ]);

    $unsendResponse
        ->assertOk()
        ->assertJsonPath('data.deleted_for_everyone_at', fn ($value) => $value !== null)
        ->assertJsonPath('data.display_text', 'Message unsent');

    expect(Conversation::query()->find($conversation->id)->last_message_preview)->toBe('Message unsent')
        ->and(
            ConversationMember::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $recipient->id)
                ->value('unread_count_cache')
        )->toBe(0);
});

it('forwards messages into another conversation and keeps forwarded metadata', function () {
    $actor = User::factory()->create();
    $sourceOther = User::factory()->create();
    $targetOther = User::factory()->create();

    $sourceConversation = createDirectConversationWithMembers($actor, $sourceOther);
    $targetConversation = createDirectConversationWithMembers($actor, $targetOther);

    $sourceMessage = Message::query()->create([
        'conversation_id' => $sourceConversation->id,
        'seq' => 1,
        'sender_id' => $sourceOther->id,
        'type' => 'text',
        'text_body' => 'Forward this update',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $sourceConversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $sourceMessage->id,
        'last_message_preview' => 'Forward this update',
        'last_message_at' => $sourceMessage->created_at,
    ])->save();

    $response = $this->actingAs($actor, 'web')
        ->postJson("/api/messages/{$sourceMessage->id}/forward", [
            'target_conversation_id' => $targetConversation->id,
            'client_uuid' => (string) str()->uuid(),
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.forwarded_from_message_id', $sourceMessage->id)
        ->assertJsonPath('data.forwarded_from_conversation_id', $sourceConversation->id)
        ->assertJsonPath('data.forwarded_from_user_id', $sourceOther->id)
        ->assertJsonPath('data.text_body', 'Forward this update');

    expect(
        ConversationMember::query()
            ->where('conversation_id', $targetConversation->id)
            ->where('user_id', $targetOther->id)
            ->value('unread_count_cache')
    )->toBe(1);
});

it('adds and removes reactions for active members', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'React to me',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $createResponse = $this->actingAs($recipient, 'web')
        ->postJson("/api/messages/{$message->id}/reactions", [
            'emoji' => '🔥',
        ]);

    $createResponse
        ->assertCreated()
        ->assertJsonPath('data.emoji', '🔥');

    expect(MessageReaction::query()->count())->toBe(1);

    $deleteResponse = $this->actingAs($recipient, 'web')
        ->deleteJson("/api/messages/{$message->id}/reactions/🔥");

    $deleteResponse
        ->assertOk()
        ->assertJsonPath('data.deleted', true);

    expect(MessageReaction::query()->count())->toBe(0);
});

it('shows blocked direct chats but blocks sending gifs, editing, and reactions', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Already here',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $conversation->forceFill([
        'last_message_seq' => 1,
        'last_message_id' => $message->id,
        'last_message_preview' => 'Already here',
        'last_message_at' => $message->created_at,
    ])->save();

    UserBlock::query()->create([
        'blocker_user_id' => $recipient->id,
        'blocked_user_id' => $sender->id,
        'block_chat' => true,
        'block_call' => true,
        'hide_presence' => true,
        'created_at' => now(),
    ]);

    $this->actingAs($sender, 'web')
        ->getJson("/api/conversations/{$conversation->id}/messages")
        ->assertOk()
        ->assertJsonPath('data.0.id', $message->id);

    $this->actingAs($sender, 'web')
        ->postJson("/api/conversations/{$conversation->id}/messages/gif", [
            'gif_meta' => [
                'url' => 'https://example.com/test.gif',
                'title' => 'Blocked gif',
            ],
            'client_uuid' => (string) str()->uuid(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.gif_meta.0', 'Messaging is blocked for this conversation.');

    $this->actingAs($sender, 'web')
        ->patchJson("/api/messages/{$message->id}", [
            'text' => 'Blocked edit',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.text.0', 'Messaging is blocked for this conversation.');

    $this->actingAs($sender, 'web')
        ->postJson("/api/messages/{$message->id}/reactions", [
            'emoji' => '🔥',
        ])
        ->assertStatus(422)
        ->assertJsonPath('errors.emoji.0', 'Messaging is blocked for this conversation.');
});

it('allows only one reaction per user per message and replaces the previous emoji', function () {
    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createDirectConversationWithMembers($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'Choose one reaction',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $firstReactionResponse = $this->actingAs($recipient, 'web')
        ->postJson("/api/messages/{$message->id}/reactions", [
            'emoji' => '👍',
        ]);

    $firstReactionResponse
        ->assertCreated()
        ->assertJsonPath('data.emoji', '👍');

    $replacementReactionResponse = $this->actingAs($recipient, 'web')
        ->postJson("/api/messages/{$message->id}/reactions", [
            'emoji' => '❤️',
        ]);

    $replacementReactionResponse
        ->assertOk()
        ->assertJsonPath('data.emoji', '❤️');

    expect(MessageReaction::query()->count())->toBe(1)
        ->and(
            MessageReaction::query()
                ->where('message_id', $message->id)
                ->where('user_id', $recipient->id)
                ->value('emoji')
        )->toBe('❤️');
});
