<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE storage_objects MODIFY purpose ENUM('message_attachment', 'user_avatar', 'group_avatar', 'company_logo') NOT NULL");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE storage_objects MODIFY purpose ENUM('message_attachment', 'user_avatar', 'group_avatar') NOT NULL");
    }
};
