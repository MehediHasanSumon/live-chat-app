<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>{{ $reportTitle }}</title>
    <style>
        @page {
            margin: 14mm 12mm 18mm;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
        }

        .report-content {
            padding-bottom: 34px;
        }

        .report-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }

        .report-header-logo-cell {
            width: 118px;
            height: 96px;
            vertical-align: middle;
        }

        .report-header-logo {
            max-height: 96px;
            max-width: 88px;
            width: auto;
            display: block;
            margin: 0 auto;
        }

        .report-header-company-cell {
            height: 96px;
            padding: 0 12px;
            text-align: center;
            vertical-align: middle;
        }

        .report-header-spacer-cell {
            width: 118px;
        }

        .report-company-name {
            margin: 0 0 8px;
            font-size: 20px;
            font-weight: bold;
            color: #000;
        }

        .report-company-line {
            margin: 4px 0;
            font-size: 12px;
            color: #333;
            line-height: 1.4;
        }

        .report-title-box {
            border: 1px solid #000;
            display: inline-block;
            padding: 8px 20px;
            background-color: #f5f5f5;
            font-weight: bold;
            font-size: 14px;
            margin-top: 10px;
        }

        .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            table-layout: fixed;
        }

        .report-table th,
        .report-table td {
            border: 1px solid #d7d7d7;
            padding: 9px 8px;
            text-align: left;
            vertical-align: middle;
            word-break: break-word;
        }

        .report-table th {
            background-color: #f2f2f2;
            font-weight: bold;
            font-size: 12px;
            color: #000;
        }

        .report-table td {
            font-size: 11px;
            color: #333;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
        }

        .empty-state {
            padding: 20px;
            text-align: center;
            color: #999;
        }

        .report-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            background-color: #fff;
        }

        .report-footer-table {
            width: 100%;
            border-collapse: collapse;
        }

        .report-footer-left,
        .report-footer-right {
            border: 0;
            color: #666;
            font-size: 10px;
            padding: 0;
        }

        .report-footer-right {
            text-align: right;
        }
    </style>
</head>

<body>
    <div class="report-content">
        @include('pdf.partials.company-header', [
            'companySetting' => $companySetting,
            'companyLogoPath' => $companyLogoPath,
            'reportTitle' => $reportTitle,
        ])

        <table class="report-table">
            <thead>
                <tr>
                    @foreach ($columns as $column)
                        <th
                            @if (!empty($column['width'])) style="width: {{ $column['width'] }};" @endif
                            class="@if (($column['align'] ?? 'left') === 'center') text-center @elseif(($column['align'] ?? 'left') === 'right') text-right @endif"
                        >
                            {{ $column['label'] }}
                        </th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @forelse ($rows as $row)
                    <tr>
                        @foreach ($row as $index => $cell)
                            @php
                                $column = $columns[$index] ?? [];
                                $align = $column['align'] ?? 'left';
                            @endphp
                            <td class="@if ($align === 'center') text-center @elseif($align === 'right') text-right @endif">
                                {{ $cell }}
                            </td>
                        @endforeach
                    </tr>
                @empty
                    <tr>
                        <td colspan="{{ count($columns) }}" class="empty-state">{{ $emptyMessage }}</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @include('pdf.partials.company-footer', [
        'generatedAt' => $generatedAt,
        'totalRecords' => $totalRecords,
    ])
</body>

</html>
