<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $hadUsername = Schema::hasColumn('users', 'username');
        $hadPhone = Schema::hasColumn('users', 'phone');

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'username')) {
                $table->string('username', 32)->nullable()->after('id');
            }

            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 20)->nullable()->after('name');
            }

            if (! Schema::hasColumn('users', 'avatar_object_id')) {
                $table->foreignId('avatar_object_id')->nullable()->after('email_verified_at');
            }

            if (! Schema::hasColumn('users', 'password_hash')) {
                $table->string('password_hash')->nullable()->after('avatar_object_id');
            }

            if (! Schema::hasColumn('users', 'status')) {
                $table->enum('status', ['active', 'suspended', 'deleted'])->default('active')->after('password_hash');
            }

            if (! Schema::hasColumn('users', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('status');
            }
        });

        if (Schema::hasColumn('users', 'password') && Schema::hasColumn('users', 'password_hash')) {
            DB::table('users')
                ->whereNull('password_hash')
                ->update(['password_hash' => DB::raw('password')]);
        }

        if (Schema::hasColumn('users', 'username')) {
            $users = DB::table('users')->select('id', 'username')->get();

            foreach ($users as $user) {
                if ($user->username) {
                    continue;
                }

                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['username' => 'user_'.$user->id]);
            }

            Schema::table('users', function (Blueprint $table) use ($hadPhone, $hadUsername) {
                if (! $hadUsername) {
                    $table->unique('username');
                }

                if (! $hadPhone) {
                    $table->unique('phone');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'username')) {
                $table->dropUnique(['username']);
                $table->dropColumn('username');
            }

            if (Schema::hasColumn('users', 'phone')) {
                $table->dropUnique(['phone']);
                $table->dropColumn('phone');
            }

            if (Schema::hasColumn('users', 'avatar_object_id')) {
                $table->dropColumn('avatar_object_id');
            }

            if (Schema::hasColumn('users', 'password_hash')) {
                $table->dropColumn('password_hash');
            }

            if (Schema::hasColumn('users', 'status')) {
                $table->dropColumn('status');
            }

            if (Schema::hasColumn('users', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }
        });
    }
};
