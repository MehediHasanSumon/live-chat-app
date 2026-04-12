<?php

namespace App\Services\LiveKit;

use Agence104\LiveKit\RoomServiceClient;
use Livekit\RoomServiceClient as ProtoRoomServiceClient;
use Psr\Http\Client\ClientInterface;

class ConfigurableRoomServiceClient extends RoomServiceClient
{
    public function __construct(
        ?string $host,
        ?string $apiKey,
        ?string $apiSecret,
        ClientInterface $httpClient,
    ) {
        parent::__construct($host, $apiKey, $apiSecret);

        $this->rpc = new ProtoRoomServiceClient($this->host, $httpClient);
    }
}
