<?php

use App\Jobs\ExtractStorageObjectMetadataJob;
use App\Jobs\ScanStorageObjectForVirusesJob;
use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\StorageObject;
use App\Models\StoragePolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

function createUploadConversation(User $leftUser, User $rightUser): Conversation
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

it('stores uploads on the private disk and dispatches metadata extraction', function () {
    Storage::fake(config('uploads.disk'));
    Queue::fake();

    $user = User::factory()->create();
    $file = UploadedFile::fake()->image('photo.png', 1200, 800);

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/uploads', [
            'file' => $file,
            'purpose' => 'message_attachment',
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.mime_type', 'image/png')
        ->assertJsonPath('data.media_kind', 'image')
        ->assertJsonPath('data.virus_scan_status', 'clean')
        ->assertJsonPath('data.download_url', fn ($value) => is_string($value) && str_contains($value, '/api/files/'));

    $storageObject = StorageObject::query()->firstOrFail();

    Storage::disk(config('uploads.disk'))->assertExists($storageObject->disk_path);

    Queue::assertPushed(ExtractStorageObjectMetadataJob::class);
    Queue::assertNotPushed(ScanStorageObjectForVirusesJob::class);
});

it('blocks uploads that exceed the configured storage cap', function () {
    Storage::fake(config('uploads.disk'));

    StoragePolicy::query()->create([
        'global_cap_bytes' => 100,
        'updated_at' => now(),
    ]);

    $user = User::factory()->create();
    $file = UploadedFile::fake()->create('big.pdf', 1, 'application/pdf');

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/uploads', [
            'file' => $file,
        ]);

    $response
        ->assertStatus(422)
        ->assertJsonPath('errors.file.0', 'The upload would exceed the global storage cap.');
});

it('stores browser voice recorder uploads as voice media', function () {
    Storage::fake(config('uploads.disk'));
    Queue::fake();

    $user = User::factory()->create();
    $file = UploadedFile::fake()->create('voice.webm', 12, 'audio/webm;codecs=opus');

    $response = $this->actingAs($user, 'web')
        ->postJson('/api/uploads', [
            'file' => $file,
            'purpose' => 'message_attachment',
            'media_kind_hint' => 'voice',
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('data.media_kind', 'voice');

    Queue::assertPushed(ExtractStorageObjectMetadataJob::class);
});

it('returns a signed private download response for uploaded files', function () {
    Storage::fake(config('uploads.disk'));

    $user = User::factory()->create();
    $file = UploadedFile::fake()->createWithContent('notes.txt', 'private-notes');

    $this->actingAs($user, 'web')
        ->post('/api/uploads', [
            'file' => $file,
        ])
        ->assertCreated();

    $storageObject = StorageObject::query()->firstOrFail();
    $signedUrl = URL::temporarySignedRoute('files.download', now()->addMinutes(5), [
        'objectUuid' => $storageObject->object_uuid,
    ]);

    $response = $this->get($signedUrl);

    $response
        ->assertOk()
        ->assertHeader('content-type', 'text/plain; charset=UTF-8');
});

it('attaches an uploaded object to a message and returns the updated message payload', function () {
    Storage::fake(config('uploads.disk'));

    $sender = User::factory()->create();
    $recipient = User::factory()->create();
    $conversation = createUploadConversation($sender, $recipient);

    $message = Message::query()->create([
        'conversation_id' => $conversation->id,
        'seq' => 1,
        'sender_id' => $sender->id,
        'type' => 'text',
        'text_body' => 'File incoming',
        'editable_until_at' => now()->addMinutes(15),
    ]);

    $this->actingAs($sender, 'web')
        ->post('/api/uploads', [
            'file' => UploadedFile::fake()->createWithContent('notes.txt', 'attachment-body'),
        ])
        ->assertCreated();

    $storageObject = StorageObject::query()->firstOrFail();

    $response = $this->actingAs($sender, 'web')
        ->postJson("/api/uploads/{$storageObject->id}/attach", [
            'message_id' => $message->id,
            'display_order' => 1,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('data.attachment.storage_object_id', $storageObject->id)
        ->assertJsonPath('data.message.attachments.0.storage_object.id', $storageObject->id);

    expect($storageObject->fresh()->ref_count)->toBe(1);
});
