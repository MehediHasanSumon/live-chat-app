@php
    $companyPhone = $companySetting ? ($companySetting->company_mobile ?: $companySetting->company_phone) : null;
@endphp

<table class="report-header-table">
    <tr>
        <td class="report-header-logo-cell">
            @if ($companyLogoPath)
                <img src="{{ $companyLogoPath }}" alt="Company Logo" class="report-header-logo">
            @endif
        </td>
        <td class="report-header-company-cell">
            @if ($companySetting)
                <div class="report-company-name">{{ $companySetting->company_name ?? 'East West Filling Station' }}</div>
                @if ($companySetting->company_address)
                    <div class="report-company-line">{{ $companySetting->company_address }}</div>
                @endif
                @if ($companySetting->company_email || $companyPhone)
                    <div class="report-company-line">
                        @if ($companySetting->company_email)
                            {{ $companySetting->company_email }}
                        @endif
                        @if ($companySetting->company_email && $companyPhone) | @endif
                        @if ($companyPhone)
                            {{ $companyPhone }}
                        @endif
                    </div>
                @endif
            @else
                <div class="report-company-name">East West Filling Station</div>
                <div class="report-company-line">Dhaka, Bangladesh</div>
                <div class="report-company-line">mehedihassan2992001@gmail.com | 01750542923</div>
            @endif

            <div class="report-title-box">{{ $reportTitle }}</div>
        </td>
        <td class="report-header-spacer-cell"></td>
    </tr>
</table>
