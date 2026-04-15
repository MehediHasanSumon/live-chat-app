<?php

namespace App\Support;

use App\Models\ProductUnit;
use Illuminate\Support\Str;

class ProductUnitCodeHelper
{
    private const PREFIX = 'PU';
    private const PAD_LENGTH = 3;

    public function generate(): string
    {
        $maxNumber = ProductUnit::query()
            ->where('unit_code', 'like', self::PREFIX . '%')
            ->pluck('unit_code')
            ->reduce(function (int $max, string $code): int {
                if (! preg_match('/^' . self::PREFIX . '(\d+)$/', $code, $matches)) {
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
        $normalizedCode = $this->normalizeCode($code);

        return ProductUnit::query()
            ->where('unit_code', $normalizedCode)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();
    }

    public function normalizeSlug(string $value): string
    {
        return Str::slug($value);
    }

    public function normalizeCode(string $code): string
    {
        return strtoupper(trim($code));
    }

    private function format(int $number): string
    {
        return self::PREFIX . str_pad((string) $number, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }
}
