<?php

namespace App\Http\Controllers;

use App\Http\Requests\Storage\AttachUploadRequest;
use App\Http\Requests\Storage\StoreUploadRequest;
use App\Http\Resources\MessageAttachmentResource;
use App\Http\Resources\MessageResource;
use App\Http\Resources\StorageObjectResource;
use App\Models\Message;
use App\Models\StorageObject;
use App\Services\Storage\StorageObjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadController extends Controller
{
    public function __construct(
        protected StorageObjectService $storageObjectService,
    ) {
    }

    public function store(StoreUploadRequest $request): JsonResponse
    {
        try {
            $storageObject = $this->storageObjectService->storeUpload(
                $request->file('file'),
                $request->user()->getKey(),
                $request->input('purpose', 'message_attachment'),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'file' => [$exception->getMessage()],
                ],
            ], 422);
        }

        return response()->json([
            'data' => (new StorageObjectResource($storageObject))->resolve($request),
        ], 201);
    }

    public function attach(AttachUploadRequest $request, StorageObject $storageObject): JsonResponse
    {
        $message = Message::query()->with(['conversation'])->findOrFail($request->integer('message_id'));

        try {
            $attachment = $this->storageObjectService->attachToMessage(
                $storageObject,
                $message,
                $request->user()->getKey(),
                (int) $request->integer('display_order', 1),
            );
        } catch (InvalidArgumentException $exception) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => [
                    'message_id' => [$exception->getMessage()],
                ],
            ], 422);
        }

        $message->load([
            'sender',
            'replyTo.sender',
            'reactions.user',
            'attachments.storageObject',
        ]);

        return response()->json([
            'data' => [
                'attachment' => (new MessageAttachmentResource($attachment))->resolve($request),
                'message' => (new MessageResource($message))->resolve($request),
            ],
        ]);
    }

    public function download(Request $request, string $objectUuid): StreamedResponse
    {
        $storageObject = $this->storageObjectService->findAccessibleObjectByUuid($objectUuid);

        abort_unless($this->storageObjectService->canDownloadObject($storageObject), 404);

        return Storage::disk(config('uploads.disk'))->download(
            $storageObject->disk_path,
            $storageObject->original_name,
            [
                'Content-Type' => $storageObject->mime_type,
            ],
        );
    }
}
