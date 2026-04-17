<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8">
    <title>Users List</title>
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
            vertical-align: middle;
            height: 96px;
        }

        .report-header-logo {
            max-height: 96px;
            max-width: 88px;
            width: auto;
            display: block;
            margin: 0 auto;
        }

        .report-header-company-cell {
            vertical-align: middle;
            text-align: center;
            padding: 0 12px;
            height: 96px;
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

        .users-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            table-layout: fixed;
        }

        .users-table th,
        .users-table td {
            border: 1px solid #d7d7d7;
            padding: 9px 8px;
            text-align: left;
            vertical-align: middle;
        }

        .users-table th {
            background-color: #f2f2f2;
            font-weight: bold;
            font-size: 12px;
            color: #000;
        }

        .users-table td {
            font-size: 11px;
            color: #333;
            word-break: break-word;
        }

        .text-center {
            text-align: center;
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
            font-size: 10px;
            color: #666;
            padding: 0;
            border: 0;
        }

        .report-footer-right {
            text-align: right;
        }

        .empty-state {
            padding: 20px;
            text-align: center;
            color: #999;
        }
    </style>
</head>

<body>
    <div class="report-content">
        @include('pdf.partials.company-header', [
            'companySetting' => $companySetting,
            'companyLogoPath' => $companyLogoPath,
            'reportTitle' => 'Users List',
        ])

        <table class="users-table">
            <thead>
                <tr>
                    <th class="text-center" style="width: 48px;">SL</th>
                    <th style="width: 110px;">Name</th>
                    <th>Email</th>
                    <th style="width: 104px;">Phone</th>
                    <th class="text-center" style="width: 72px;">Status</th>
                    <th class="text-center" style="width: 92px;">Verified</th>
                    <th style="width: 110px;">Role</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($users as $index => $user)
                    <tr>
                        <td class="text-center">{{ $index + 1 }}</td>
                        <td>{{ $user->name }}</td>
                        <td>{{ $user->email }}</td>
                        <td>{{ $user->phone ?: '-' }}</td>
                        <td class="text-center">{{ ucfirst($user->status) }}</td>
                        <td class="text-center">{{ $user->email_verified_at ? $user->email_verified_at->format('d M Y') : 'Not verified' }}</td>
                        <td>
                            @if ($user->roles && $user->roles->count() > 0)
                                {{ $user->roles->pluck('name')->join(', ') }}
                            @else
                                No Role
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" class="empty-state">No users found</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @include('pdf.partials.company-footer', [
        'generatedAt' => $generatedAt,
        'totalRecords' => $users->count(),
    ])
</body>

</html>
