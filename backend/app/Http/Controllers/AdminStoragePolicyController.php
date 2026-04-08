<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\AuthorizesStorageAdmin;
use App\Http\Requests\Storage\PreviewStorageCleanupRequest;
use App\Http\Requests\Storage\RunStorageCleanupRequest;
use App\Http\Requests\Storage\UpdateStoragePolicyRequest;
use App\Http\Resources\StorageCleanupRunResource;
use App\Http\Resources\StorageObjectResource;
use App\Http\Resources\StoragePolicyResource;
use App\Http\Resources\StorageUsageCounterResource;
use App\Models\StorageObject;
use App\Services\Storage\StorageCleanupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminStoragePolicyController extends Controller
{
    use AuthorizesStorageAdmin;

    public function __construct(
        protected StorageCleanupService $storageCleanupService,
    ) {
    }

    public function showPolicy(Request $request): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        return response()->json([
            'data' => (new StoragePolicyResource($this->storageCleanupService->policy()))->resolve($request),
        ]);
    }

    public function updatePolicy(UpdateStoragePolicyRequest $request): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        $policy = $this->storageCleanupService->updatePolicy(
            $request->validated(),
            $request->user()->getKey(),
        );

        return response()->json([
            'data' => (new StoragePolicyResource($policy))->resolve($request),
        ]);
    }

    public function usage(Request $request): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        return response()->json([
            'data' => (new StorageUsageCounterResource($this->storageCleanupService->usage()))->resolve($request),
        ]);
    }

    public function previewCleanup(PreviewStorageCleanupRequest $request): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        $preview = $this->storageCleanupService->preview(
            $request->string('rule_key')->toString(),
            (int) $request->integer('limit', 25),
        );

        return response()->json([
            'data' => [
                'rule_key' => $preview['rule_key'],
                'objects_scanned' => $preview['objects_scanned'],
                'bytes_freed' => $preview['bytes_freed'],
                'objects' => StorageObjectResource::collection($preview['objects'])->resolve(),
            ],
        ]);
    }

    public function runCleanup(RunStorageCleanupRequest $request): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        $run = $this->storageCleanupService->run(
            $request->string('rule_key')->toString(),
            $request->user()->getKey(),
            (bool) $request->boolean('dry_run', false),
        );

        return response()->json([
            'data' => (new StorageCleanupRunResource($run))->resolve($request),
        ]);
    }

    public function exempt(Request $request, StorageObject $storageObject): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        $updatedObject = $this->storageCleanupService->exemptObject(
            $storageObject,
            $request->user()->getKey(),
        );

        return response()->json([
            'data' => (new StorageObjectResource($updatedObject))->resolve($request),
        ]);
    }

    public function removeExemption(Request $request, StorageObject $storageObject): JsonResponse
    {
        $this->authorizeStorageAdmin($request);

        $updatedObject = $this->storageCleanupService->removeExemption(
            $storageObject,
            $request->user()->getKey(),
        );

        return response()->json([
            'data' => (new StorageObjectResource($updatedObject))->resolve($request),
        ]);
    }
}
