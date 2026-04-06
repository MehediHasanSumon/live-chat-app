<?php

namespace App\Services\LiveKit;

use Agence104\LiveKit\RoomCreateOptions;
use Agence104\LiveKit\RoomServiceClient;

class LiveKitRoomService
{
    protected function client(): RoomServiceClient
    {
        return new RoomServiceClient(
            config('livekit.url'),
            config('livekit.api_key'),
            config('livekit.api_secret'),
        );
    }

    public function createRoom(string $roomName, array $options = []): array
    {
        $room = $this->client()->createRoom(
            (new RoomCreateOptions())
                ->setName($roomName)
                ->setEmptyTimeout((int) ($options['empty_timeout'] ?? config('livekit.default_room_empty_timeout')))
                ->setMaxParticipants((int) ($options['max_participants'] ?? config('livekit.default_room_max_participants')))
        );

        return [
            'name' => $room->getName(),
            'sid' => $room->getSid(),
            'empty_timeout' => $room->getEmptyTimeout(),
            'max_participants' => $room->getMaxParticipants(),
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
