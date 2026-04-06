<?php

namespace App\Services\LiveKit;

use Agence104\LiveKit\AccessToken;
use Agence104\LiveKit\AccessTokenOptions;
use Agence104\LiveKit\VideoGrant;
use App\Models\User;

class LiveKitTokenService
{
    public function issueJoinToken(
        User $user,
        string $roomName,
        array $permissions = []
    ): array {
        $identity = (string) $user->getAuthIdentifier();

        $options = (new AccessTokenOptions())
            ->setIdentity($identity)
            ->setName($user->name)
            ->setTtl(config('livekit.token_ttl'))
            ->setMetadata(json_encode([
                'user_id' => $user->getAuthIdentifier(),
                'email' => $user->email,
                ...config('livekit.default_metadata_claims'),
            ], JSON_THROW_ON_ERROR))
            ->setAttributes([
                'user_id' => (string) $user->getAuthIdentifier(),
            ]);

        $grant = (new VideoGrant())
            ->setRoomJoin()
            ->setRoomName($roomName)
            ->setCanPublish((bool) ($permissions['can_publish'] ?? true))
            ->setCanSubscribe((bool) ($permissions['can_subscribe'] ?? true))
            ->setCanPublishData((bool) ($permissions['can_publish_data'] ?? true))
            ->setCanUpdateOwnMetadata((bool) ($permissions['can_update_own_metadata'] ?? false));

        if (! empty($permissions['can_publish_sources']) && is_array($permissions['can_publish_sources'])) {
            $grant->setCanPublishSources($permissions['can_publish_sources']);
        }

        $token = (new AccessToken(
            config('livekit.api_key'),
            config('livekit.api_secret'),
        ))
            ->init($options)
            ->setGrant($grant)
            ->toJwt();

        return [
            'token' => $token,
            'url' => config('livekit.url'),
            'room' => $roomName,
            'identity' => $identity,
            'ttl' => config('livekit.token_ttl'),
        ];
    }
}
