<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\ResourceCollection;

class CursorPaginatedCollection extends ResourceCollection
{
    /**
     * Cursor for pagination
     */
    protected ?int $cursor = null;

    /**
     * Next cursor for pagination
     */
    protected ?int $nextCursor = null;

    /**
     * Has more results
     */
    protected bool $hasMore = false;

    /**
     * Total items count (optional)
     */
    protected ?int $total = null;

    /**
     * Set cursor information
     */
    public function withCursor(?int $cursor, ?int $nextCursor = null, bool $hasMore = false): self
    {
        $this->cursor = $cursor;
        $this->nextCursor = $nextCursor;
        $this->hasMore = $hasMore;
        return $this;
    }

    /**
     * Set total count
     */
    public function withTotal(?int $total): self
    {
        $this->total = $total;
        return $this;
    }

    /**
     * Transform the resource collection into an array
     */
    public function toArray($request)
    {
        return $this->collection->toArray();
    }

    /**
     * Get additional data that should be returned with the resource array
     */
    public function with($request)
    {
        $meta = [
            'cursor' => $this->cursor,
            'next_cursor' => $this->nextCursor,
            'has_more' => $this->hasMore,
        ];

        if ($this->total !== null) {
            $meta['total'] = $this->total;
        }

        return [
            'meta' => $meta,
        ];
    }
}
