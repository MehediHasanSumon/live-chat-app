<?php

namespace App\Http\Controllers\Concerns;

use App\Models\StorageObject;
use App\Services\Company\PublicCompanySettingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait InteractsWithPdfReports
{
    protected function downloadTableReportPdf(
        string $reportTitle,
        array $columns,
        array $rows,
        CarbonInterface $generatedAt,
        string $filenamePrefix,
        array $options = [],
    ) {
        $pdf = Pdf::loadView('pdf.reports.table', [
            ...$this->companyPdfViewData(),
            'reportTitle' => $reportTitle,
            'columns' => $columns,
            'rows' => $rows,
            'generatedAt' => $generatedAt,
            'totalRecords' => $options['totalRecords'] ?? count($rows),
            'emptyMessage' => $options['emptyMessage'] ?? 'No records found.',
        ])->setPaper('a4', $options['orientation'] ?? 'portrait');

        return $pdf->download($this->pdfFilename($filenamePrefix, $generatedAt));
    }

    protected function downloadDetailReportPdf(
        string $reportTitle,
        array $sections,
        CarbonInterface $generatedAt,
        string $filenamePrefix,
        array $options = [],
    ) {
        $pdf = Pdf::loadView('pdf.reports.detail', [
            ...$this->companyPdfViewData(),
            'reportTitle' => $reportTitle,
            'sections' => $sections,
            'summaryItems' => $options['summaryItems'] ?? [],
            'tables' => $options['tables'] ?? [],
            'generatedAt' => $generatedAt,
            'totalRecords' => $options['totalRecords'] ?? 1,
        ])->setPaper('a4', $options['orientation'] ?? 'portrait');

        return $pdf->download($this->pdfFilename($filenamePrefix, $generatedAt));
    }

    protected function companyPdfViewData(): array
    {
        $companySetting = app(PublicCompanySettingService::class)->activeSetting();

        return [
            'companySetting' => $companySetting,
            'companyLogoPath' => $companySetting ? $this->companyLogoPath($companySetting->company_logo) : null,
        ];
    }

    protected function companyLogoPath(?string $companyLogoUuid): ?string
    {
        if (! $companyLogoUuid) {
            return null;
        }

        $storageObject = StorageObject::query()
            ->where('object_uuid', $companyLogoUuid)
            ->whereNull('deleted_at')
            ->first();

        if (! $storageObject) {
            return null;
        }

        $disk = Storage::disk(config('uploads.disk'));

        if (! $disk->exists($storageObject->disk_path)) {
            return null;
        }

        return $disk->path($storageObject->disk_path);
    }

    protected function pdfFilename(string $prefix, CarbonInterface $generatedAt): string
    {
        return Str::slug($prefix).'-'.$generatedAt->format('Y-m-d-His').'.pdf';
    }

    protected function pdfText(mixed $value, string $fallback = '-'): string
    {
        if ($value === null) {
            return $fallback;
        }

        if (is_string($value)) {
            return trim($value) !== '' ? $value : $fallback;
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if ($value instanceof CarbonInterface) {
            return $value->format('d M Y h:i A');
        }

        return (string) $value;
    }

    protected function pdfDate(mixed $value, string $fallback = '-'): string
    {
        if (! $value) {
            return $fallback;
        }

        return Carbon::parse($value)->format('d M Y');
    }

    protected function pdfDateTime(mixed $value, string $fallback = '-'): string
    {
        if (! $value) {
            return $fallback;
        }

        return Carbon::parse($value)->format('d M Y h:i A');
    }

    protected function pdfMoney(mixed $value, string $prefix = 'BDT '): string
    {
        return $prefix.number_format((float) ($value ?? 0), 2, '.', '');
    }
}
