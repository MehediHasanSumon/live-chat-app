<?php

namespace App\Services\Realtime;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class MessageBatcherService
{
    /**
     * Message batches organized by channel
     */
    protected array $batches = [];

    /**
     * Batch configuration
     */
    protected array $batchConfig = [];

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->batchConfig = config('reverb.servers.reverb.message_batching', [
            'enabled' => true,
            'batch_size' => 10,
            'batch_interval_ms' => 50,
        ]);
    }

    /**
     * Add message to batch
     */
    public function add(string $channel, array $message): void
    {
        if (!$this->isEnabled()) {
            return;
        }

        if (!isset($this->batches[$channel])) {
            $this->batches[$channel] = [
                'messages' => [],
                'added_at' => microtime(true),
            ];
        }

        $this->batches[$channel]['messages'][] = $message;

        // Check if batch should be flushed
        if ($this->shouldFlush($channel)) {
            $this->flush($channel);
        }
    }

    /**
     * Add multiple messages to batch
     */
    public function addMany(string $channel, array $messages): void
    {
        foreach ($messages as $message) {
            $this->add($channel, $message);
        }
    }

    /**
     * Get batch for channel
     */
    public function getBatch(string $channel): ?array
    {
        return $this->batches[$channel] ?? null;
    }

    /**
     * Check if batch should be flushed
     */
    protected function shouldFlush(string $channel): bool
    {
        if (!isset($this->batches[$channel])) {
            return false;
        }

        $batch = $this->batches[$channel];
        $config = $this->getChannelConfig($channel);
        $messageCount = count($batch['messages']);
        $elapsedMs = (microtime(true) - $batch['added_at']) * 1000;

        // Flush if reached batch size or exceeded interval
        return $messageCount >= $config['batch_size'] || $elapsedMs >= $config['batch_interval_ms'];
    }

    /**
     * Flush batch for channel
     */
    public function flush(string $channel): array
    {
        $batch = $this->batches[$channel] ?? null;

        if (!$batch || empty($batch['messages'])) {
            return [];
        }

        $messages = $batch['messages'];

        // Clear batch
        unset($this->batches[$channel]);

        Log::debug("Flushed WebSocket batch for channel: {$channel}", [
            'message_count' => count($messages),
            'batch_size' => $this->getChannelConfig($channel)['batch_size'],
        ]);

        return $messages;
    }

    /**
     * Flush all pending batches
     */
    public function flushAll(): array
    {
        $allMessages = [];

        foreach (array_keys($this->batches) as $channel) {
            $messages = $this->flush($channel);
            $allMessages[$channel] = $messages;
        }

        return $allMessages;
    }

    /**
     * Get pending message count
     */
    public function getPendingCount(string $channel = null): int
    {
        if ($channel) {
            $batch = $this->batches[$channel] ?? null;
            return $batch ? count($batch['messages']) : 0;
        }

        $count = 0;
        foreach ($this->batches as $batch) {
            $count += count($batch['messages']);
        }

        return $count;
    }

    /**
     * Check if batching is enabled
     */
    protected function isEnabled(): bool
    {
        return $this->batchConfig['enabled'] ?? true;
    }

    /**
     * Get configuration for channel
     */
    protected function getChannelConfig(string $channel): array
    {
        $channels = $this->batchConfig['channels'] ?? [];
        $config = [
            'batch_size' => $this->batchConfig['batch_size'] ?? 10,
            'batch_interval_ms' => $this->batchConfig['batch_interval_ms'] ?? 50,
        ];

        // Check for channel-specific config
        foreach ($channels as $pattern => $patternConfig) {
            if ($this->matchesPattern($channel, $pattern)) {
                return array_merge($config, $patternConfig);
            }
        }

        return $config;
    }

    /**
     * Check if channel matches pattern
     */
    protected function matchesPattern(string $channel, string $pattern): bool
    {
        // Convert * wildcards to regex
        $regex = '^' . str_replace('*', '.*', $pattern) . '$';
        $regex = str_replace('\*', '.*', preg_quote($pattern, '#'));
        return (bool) preg_match("#^{$regex}$#", $channel);
    }

    /**
     * Clear all batches
     */
    public function clear(): void
    {
        $this->batches = [];
    }

    /**
     * Get batch statistics
     */
    public function getStats(): array
    {
        $stats = [
            'total_pending' => $this->getPendingCount(),
            'batches' => count($this->batches),
            'channels' => [],
        ];

        foreach ($this->batches as $channel => $batch) {
            $stats['channels'][$channel] = [
                'pending' => count($batch['messages']),
                'age_ms' => (microtime(true) - $batch['added_at']) * 1000,
            ];
        }

        return $stats;
    }

    /**
     * Create batch envelope for transmission
     */
    public function createBatchEnvelope(string $channel, array $messages): array
    {
        return [
            'type' => 'batch',
            'channel' => $channel,
            'count' => count($messages),
            'created_at' => now()->toIso8601String(),
            'messages' => $messages,
        ];
    }
}
