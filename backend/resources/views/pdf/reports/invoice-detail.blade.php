<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>{{ $reportTitle }}</title>
    <style>
        @page {
            margin: 14mm 12mm 16mm;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            margin: 0;
            color: #111;
        }

        .invoice-wrap {
            width: 100%;
        }

        .report-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
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

        .meta-table,
        .invoice-table,
        .signature-table {
            width: 100%;
            border-collapse: collapse;
        }

        .meta-table {
            margin-bottom: 18px;
        }

        .meta-left,
        .meta-right {
            width: 50%;
            vertical-align: top;
            font-size: 11px;
            font-weight: bold;
        }

        .meta-right {
            text-align: right;
        }

        .meta-line {
            margin: 2px 0;
        }

        .invoice-table {
            margin-top: 4px;
            table-layout: fixed;
        }

        .invoice-table th,
        .invoice-table td {
            border: 1px solid #d3d3d3;
            padding: 8px 6px;
            font-size: 11px;
            vertical-align: top;
        }

        .invoice-table th {
            background: #f3f3f3;
            color: #000;
            font-weight: bold;
            text-align: left;
        }

        .text-center {
            text-align: center;
        }

        .text-right {
            text-align: right;
        }

        .grand-row td {
            background: #ececec;
            font-weight: bold;
        }

        .amount-box {
            margin-top: 20px;
            border: 1px solid #d9d9d9;
            background: #fafafa;
            padding: 16px;
        }

        .amount-line {
            margin: 4px 0;
            font-size: 12px;
            font-weight: bold;
        }

        .amount-words {
            margin-top: 8px;
            font-size: 12px;
            font-style: italic;
        }

        .signature-table {
            margin-top: 76px;
        }

        .signature-cell {
            width: 33.33%;
            text-align: center;
            vertical-align: top;
            font-size: 12px;
            font-weight: bold;
        }

        .signature-line {
            width: 150px;
            margin: 0 auto 10px;
            border-top: 1px solid #666;
            height: 18px;
        }
    </style>
</head>

<body>
    <div class="invoice-wrap">
        @include('pdf.partials.company-header', [
            'companySetting' => $companySetting,
            'companyLogoPath' => $companyLogoPath,
            'reportTitle' => $reportTitle,
        ])

        <table class="meta-table">
            <tr>
                <td class="meta-left">
                    <div class="meta-line">Customer: {{ $invoice->customer?->name ?? '-' }}</div>
                    <div class="meta-line">Mobile: {{ $invoice->customer?->mobile ?? 'N/A' }}</div>
                    <div class="meta-line">Date: {{ optional($invoice->invoice_datetime)->format('d/m/Y') ?? '-' }}</div>
                </td>
                <td class="meta-right">
                    <div class="meta-line">Total Product: {{ $invoice->items->count() }}</div>
                    <div class="meta-line">Total Amount: {{ number_format((float) $invoice->total_amount, 2, '.', ',') }}</div>
                    <div class="meta-line">Paid Amount: {{ number_format((float) $invoice->paid_amount, 2, '.', ',') }}</div>
                    <div class="meta-line">Due Amount: {{ number_format((float) $invoice->due_amount, 2, '.', ',') }}</div>
                </td>
            </tr>
        </table>

        <table class="invoice-table">
            <thead>
                <tr>
                    <th style="width: 36px;" class="text-center">SL</th>
                    <th style="width: 92px;">Invoice No</th>
                    <th style="width: 92px;">Vehicle No</th>
                    <th>Product Name</th>
                    <th style="width: 54px;">Unit</th>
                    <th style="width: 74px;" class="text-right">Quantity</th>
                    <th style="width: 82px;" class="text-right">Unit Price</th>
                    <th style="width: 82px;" class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($invoice->items as $index => $item)
                    <tr>
                        <td class="text-center">{{ $index + 1 }}</td>
                        <td>{{ $invoice->invoice_no }}</td>
                        <td>{{ $invoice->customer?->vehicle_no ?? '0' }}</td>
                        <td>{{ $item->product_name }}</td>
                        <td>{{ $item->unit_name ?: ($item->unit_code ?: '-') }}</td>
                        <td class="text-right">{{ number_format((float) $item->quantity, 2, '.', '') }}</td>
                        <td class="text-right">{{ number_format((float) $item->price, 2, '.', ',') }}</td>
                        <td class="text-right">{{ number_format((float) $item->line_total, 2, '.', ',') }}</td>
                    </tr>
                @endforeach
                <tr class="grand-row">
                    <td colspan="7" class="text-right">Grand Total:</td>
                    <td class="text-right">{{ number_format((float) $invoice->total_amount, 2, '.', ',') }}</td>
                </tr>
            </tbody>
        </table>

        <div class="amount-box">
            <div class="amount-line">Total Amount: {{ number_format((float) $invoice->total_amount, 2, '.', ',') }}</div>
            <div class="amount-line">Paid Amount: {{ number_format((float) $invoice->paid_amount, 2, '.', ',') }}</div>
            <div class="amount-words">In words: {{ $amountInWords }}</div>
        </div>

        <table class="signature-table">
            <tr>
                <td class="signature-cell">
                    <div class="signature-line"></div>
                    Customer Signature
                </td>
                <td class="signature-cell">
                    <div class="signature-line"></div>
                    Prepared By
                </td>
                <td class="signature-cell">
                    <div class="signature-line"></div>
                    Authorized By
                </td>
            </tr>
        </table>
    </div>
</body>

</html>
