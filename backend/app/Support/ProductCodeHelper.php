<?php

namespace App\Support;

use App\Models\Product;

class ProductCodeHelper
{
    private const PREFIX = 'P';
    private const PAD_LENGTH = 3;

    public function generate(): string
    {
        $maxNumber = Product::query()
            ->where('product_code', 'like', self::PREFIX . '%')
            ->pluck('product_code')
            ->reduce(function (int $max, ?string $code): int {
                if (! $code || ! preg_match('/^' . self::PREFIX . '(\d+)$/', $code, $matches)) {
                    return $max;
                }

                return max($max, (int) $matches[1]);
            }, 0);

        $nextNumber = $maxNumber + 1;
        $code = $this->format($nextNumber);

        while ($this->exists($code)) {
            $nextNumber++;
            $code = $this->format($nextNumber);
        }

        return $code;
    }

    public function exists(string $code, ?int $ignoreId = null): bool
    {
        return Product::query()
            ->where('product_code', $this->normalize($code))
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();
    }

    public function normalize(string $code): string
    {
        return strtoupper(trim($code));
    }

    private function format(int $number): string
    {
        return self::PREFIX . str_pad((string) $number, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
