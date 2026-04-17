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

        .summary-grid {
            margin: 10px 0 14px;
            width: 100%;
            border-collapse: separate;
            border-spacing: 10px 0;
        }

        .summary-card {
            border: 1px solid #d7d7d7;
            background-color: #fafafa;
            padding: 10px 12px;
            vertical-align: top;
        }

        .summary-label {
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 4px;
        }

        .summary-value {
            font-size: 13px;
            font-weight: bold;
            color: #111;
        }

        .section {
            margin-top: 16px;
            page-break-inside: avoid;
        }

        .section-title {
            margin: 0 0 8px;
            font-size: 14px;
            font-weight: bold;
            color: #111;
        }

        .section-table,
        .data-table,
        .report-footer-table {
            width: 100%;
            border-collapse: collapse;
        }

        .section-table td {
            border: 1px solid #d7d7d7;
            padding: 8px 10px;
            vertical-align: top;
        }

        .field-label {
            width: 170px;
            background-color: #f7f7f7;
            font-size: 11px;
            font-weight: bold;
            color: #444;
        }

        .field-value {
            color: #222;
            font-size: 11px;
        }

        .data-table {
            margin-top: 8px;
            table-layout: fixed;
        }

        .data-table th,
        .data-table td {
            border: 1px solid #d7d7d7;
            padding: 9px 8px;
            text-align: left;
            vertical-align: middle;
            word-break: break-word;
        }

        .data-table th {
            background-color: #f2f2f2;
            font-size: 12px;
            font-weight: bold;
            color: #000;
        }

        .data-table td {
            font-size: 11px;
            color: #333;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
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

        @if (!empty($summaryItems))
            <table class="summary-grid">
                <tr>
                    @foreach ($summaryItems as $item)
                        <td class="summary-card">
                            <div class="summary-label">{{ $item['label'] }}</div>
                            <div class="summary-value">{{ $item['value'] }}</div>
                        </td>
                    @endforeach
                </tr>
            </table>
        @endif

        @foreach ($sections as $section)
            <div class="section">
                <h2 class="section-title">{{ $section['title'] }}</h2>
                <table class="section-table">
                    @foreach ($section['fields'] as $field)
                        <tr>
                            <td class="field-label">{{ $field['label'] }}</td>
                            <td class="field-value">{{ $field['value'] }}</td>
                        </tr>
                    @endforeach
                </table>
            </div>
        @endforeach

        @foreach ($tables as $table)
            <div class="section">
                <h2 class="section-title">{{ $table['title'] }}</h2>
                <table class="data-table">
                    <thead>
                        <tr>
                            @foreach ($table['columns'] as $column)
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
                        @foreach ($table['rows'] as $row)
                            <tr>
                                @foreach ($row as $index => $cell)
                                    @php
                                        $column = $table['columns'][$index] ?? [];
                                        $align = $column['align'] ?? 'left';
                                    @endphp
                                    <td class="@if ($align === 'center') text-center @elseif($align === 'right') text-right @endif">
                                        {{ $cell }}
                                    </td>
                                @endforeach
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endforeach
    </div>

    @include('pdf.partials.company-footer', [
        'generatedAt' => $generatedAt,
        'totalRecords' => $totalRecords,
    ])
</body>

</html>
