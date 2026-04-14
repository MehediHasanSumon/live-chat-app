<?php

return [
    'ringing_timeout_seconds' => (int) env('CALL_RINGING_TIMEOUT_SECONDS', 45),
    'connecting_timeout_seconds' => (int) env('CALL_CONNECTING_TIMEOUT_SECONDS', 90),
];
