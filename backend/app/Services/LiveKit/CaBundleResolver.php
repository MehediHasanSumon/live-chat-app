<?php

namespace App\Services\LiveKit;

use GuzzleHttp\Utils;

class CaBundleResolver
{
    public function resolve(): ?string
    {
        $configured = $this->normalize(config('livekit.ca_bundle'));

        if (is_string($configured) && $configured !== '' && is_file($configured)) {
            return $configured;
        }

        $iniOpenSsl = $this->normalize(ini_get('openssl.cafile'));

        if (is_string($iniOpenSsl) && $iniOpenSsl !== '' && is_file($iniOpenSsl)) {
            return $iniOpenSsl;
        }

        $iniCurl = $this->normalize(ini_get('curl.cainfo'));

        if (is_string($iniCurl) && $iniCurl !== '' && is_file($iniCurl)) {
            return $iniCurl;
        }

        $locations = function_exists('openssl_get_cert_locations')
            ? openssl_get_cert_locations()
            : [];

        $defaultCertFile = $this->normalize($locations['default_cert_file'] ?? null);

        if (is_string($defaultCertFile) && $defaultCertFile !== '' && is_file($defaultCertFile)) {
            return $defaultCertFile;
        }

        try {
            $guzzleBundle = $this->normalize(Utils::defaultCaBundle());

            if (is_string($guzzleBundle) && $guzzleBundle !== '' && is_file($guzzleBundle)) {
                return $guzzleBundle;
            }
        } catch (\Throwable) {
            // Let the caller surface the original SSL error if no CA bundle can be resolved.
        }

        $userProfile = getenv('USERPROFILE');

        if (is_string($userProfile) && $userProfile !== '') {
            $commonWindowsCandidates = [
                $userProfile.'\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\certifi\\cacert.pem',
                $userProfile.'\\AppData\\Local\\Programs\\Python\\Python311\\Lib\\site-packages\\certifi\\cacert.pem',
                $userProfile.'\\AppData\\Local\\Programs\\Python\\Python310\\Lib\\site-packages\\certifi\\cacert.pem',
                $userProfile.'\\AppData\\Local\\Programs\\Python\\Python39\\Lib\\site-packages\\certifi\\cacert.pem',
                $userProfile.'\\Desktop\\Auto\\venv\\Lib\\site-packages\\pip\\_vendor\\certifi\\cacert.pem',
                $userProfile.'\\Desktop\\Bombing\\venv\\Lib\\site-packages\\certifi\\cacert.pem',
                $userProfile.'\\Desktop\\Bombing\\venv\\Lib\\site-packages\\pip\\_vendor\\certifi\\cacert.pem',
            ];

            foreach ($commonWindowsCandidates as $candidate) {
                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    protected function normalize(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (str_contains($value, '=')) {
            [$key, $maybePath] = array_pad(explode('=', $value, 2), 2, null);

            if ($key === 'LIVEKIT_CA_BUNDLE' && is_string($maybePath) && $maybePath !== '') {
                $value = trim($maybePath);
            }
        }

        return trim($value, " \t\n\r\0\x0B\"'");
    }
}
