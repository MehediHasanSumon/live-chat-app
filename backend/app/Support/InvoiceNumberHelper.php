<?php

namespace App\Support;

use App\Models\Invoice;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class InvoiceNumberHelper
{
    private const PREFIX = 'INV';
    private const PAD_LENGTH = 5;

    public function generate(CarbonInterface|string|null $date = null): string
    {
        $invoiceDate = $this->parseDate($date);
        $prefix = $this->prefixFor($invoiceDate);
        $maxNumber = Invoice::query()
            ->where('invoice_no', 'like', $prefix . '%')
            ->pluck('invoice_no')
            ->reduce(function (int $max, ?string $invoiceNo) use ($prefix): int {
                if (! $invoiceNo || ! preg_match('/^' . preg_quote($prefix, '/') . '(\d+)$/', $invoiceNo, $matches)) {
                    return $max;
                }

                return max($max, (int) $matches[1]);
            }, 0);

        $nextNumber = $maxNumber + 1;
        $invoiceNo = $this->format($invoiceDate, $nextNumber);

        while ($this->exists($invoiceNo)) {
            $nextNumber++;
            $invoiceNo = $this->format($invoiceDate, $nextNumber);
        }

        return $invoiceNo;
    }

    public function exists(string $invoiceNo, ?int $ignoreId = null): bool
    {
        return Invoice::query()
            ->where('invoice_no', $this->normalize($invoiceNo))
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();
    }

    public function normalize(string $invoiceNo): string
    {
        return strtoupper(trim($invoiceNo));
    }

    public function pattern(): string
    {
        return '/^' . self::PREFIX . '-\d{6}-\d{' . self::PAD_LENGTH . '}$/';
    }

    private function format(CarbonInterface $date, int $number): string
    {
        return $this->prefixFor($date) . str_pad((string) $number, self::PAD_LENGTH, '0', STR_PAD_LEFT);
    }

    private function prefixFor(CarbonInterface $date): string
    {
        return self::PREFIX . '-' . $date->format('Ym') . '-';
    }

    private function parseDate(CarbonInterface|string|null $date): CarbonInterface
    {
        if ($date instanceof CarbonInterface) {
            return $date;
        }

        if (is_string($date) && trim($date) !== '') {
            return Carbon::parse($date);
        }

        return now();
    }
}
