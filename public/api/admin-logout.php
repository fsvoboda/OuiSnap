<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
require_post();

start_admin_session();
$_SESSION = [];
session_destroy();
reply(200, ['ok' => true]);
