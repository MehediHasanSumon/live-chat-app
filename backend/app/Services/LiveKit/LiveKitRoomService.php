<?php

namespace App\Services\LiveKit;

use Agence104\LiveKit\RoomCreateOptions;
use GuzzleHttp\Client;

class LiveKitRoomService
{
    public function __construct(
        protected CaBundleResolver $caBundleResolver,
    ) {}

    protected function client(): ConfigurableRoomServiceClient
    {
        $caBundle = $this->caBundleResolver->resolve();

        return new ConfigurableRoomServiceClient(
            config('livekit.url'),
            config('livekit.api_key'),
            config('livekit.api_secret'),
            new Client(array_filter([
                'verify' => $caBundle ?: true,
                'timeout' => 10,
            ], static fn (mixed $value): bool => $value !== null)),
        );
    }

    public function createRoom(string $roomName, array $options = []): array
    {
        $maxParticipants = min(
            (int) ($options['max_participants'] ?? config('livekit.default_room_max_participants')),
            (int) config('livekit.default_room_max_participants')
        );

        $room = $this->client()->createRoom(
            (new RoomCreateOptions())
                ->setName($roomName)
                ->setEmptyTimeout((int) ($options['empty_timeout'] ?? config('livekit.default_room_empty_timeout')))
                ->setMaxParticipants($maxParticipants)
        );

        return [
            'name' => $room->getName(),
            'sid' => $room->getSid(),
            'empty_timeout' => $room->getEmptyTimeout(),
            'max_participants' => $maxParticipants,
            'max_video_publishers' => (int) config('livekit.default_room_max_video_publishers'),
            'creation_time' => $room->getCreationTime(),
            'metadata' => $room->getMetadata(),
        ];
    }

    public function listRooms(): array
    {
        $response = $this->client()->listRooms();

        $rooms = [];

        foreach ($response->getRooms() as $room) {
            $rooms[] = [
                'name' => $room->getName(),
                'sid' => $room->getSid(),
                'num_participants' => $room->getNumParticipants(),
                'max_participants' => $room->getMaxParticipants(),
                'metadata' => $room->getMetadata(),
            ];
        }

        return $rooms;
    }
}
