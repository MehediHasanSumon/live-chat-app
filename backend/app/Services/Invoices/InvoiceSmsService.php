<?php

namespace App\Services\Invoices;

use App\Models\Invoice;
use App\Models\InvoiceSmsLog;
use App\Models\InvoiceSmsTemplate;
use App\Models\SmsServiceCredential;
use Illuminate\Support\Facades\Http;
use Throwable;

class InvoiceSmsService
{
    public function sendInvoiceCreatedNotification(Invoice $invoice): ?InvoiceSmsLog
    {
        if (! $invoice->sms_enabled) {
            return null;
        }

        $invoice->loadMissing(['customer', 'items']);
        $customer = $invoice->customer;
        $mobile = trim((string) ($customer?->mobile ?? ''));
        $credential = SmsServiceCredential::query()
            ->where('status', SmsServiceCredential::STATUS_ACTIVE)
            ->latest('id')
            ->first();
        $template = InvoiceSmsTemplate::query()
            ->where('status', InvoiceSmsTemplate::STATUS_ACTIVE)
            ->orderByDesc('is_default')
            ->latest('id')
            ->first();
        $message = $template?->renderForInvoice($invoice);
        $log = InvoiceSmsLog::query()->create([
            'invoice_id' => $invoice->id,
            'customer_id' => $customer?->id,
            'sms_service_credential_id' => $credential?->id,
            'invoice_sms_template_id' => $template?->id,
            'recipient_name' => $customer?->name,
            'mobile' => $mobile,
            'sender_id' => $credential?->sender_id,
            'message' => $message,
            'status' => 'pending',
        ]);

        if ($mobile === '' || ! $credential || ! $template || ! $message) {
            $log->forceFill([
                'status' => 'failed',
                'provider_response' => [
                    'error' => $this->missingConfigurationReason($mobile, $credential, $template, $message),
                ],
            ])->save();

            return $log;
        }

        try {
            $response = Http::asForm()
                ->timeout(15)
                ->post($credential->url, [
                    'api_key' => $credential->api_key,
                    'sender_id' => $credential->sender_id,
                    'to' => $mobile,
                    'mobile' => $mobile,
                    'message' => $message,
                ]);

            $log->forceFill([
                'status' => $response->successful() ? 'sent' : 'failed',
                'provider_response' => [
                    'status' => $response->status(),
                    'body' => $response->json() ?? $response->body(),
                ],
                'sent_at' => $response->successful() ? now() : null,
            ])->save();
        } catch (Throwable $exception) {
            $log->forceFill([
                'status' => 'failed',
                'provider_response' => [
                    'error' => $exception->getMessage(),
                ],
            ])->save();
        }

        return $log;
    }

    protected function missingConfigurationReason(
        string $mobile,
        ?SmsServiceCredential $credential,
        ?InvoiceSmsTemplate $template,
        ?string $message,
    ): string {
        if ($mobile === '') {
            return 'customer_mobile_missing';
        }

        if (! $credential) {
            return 'active_sms_credential_missing';
        }

        if (! $template) {
            return 'active_invoice_sms_template_missing';
        }

        if (! $message) {
            return 'invoice_sms_message_empty';
        }

        return 'sms_not_ready';
    }
}
