alter table account_sessions
    alter column trusted_device_token_hash type varchar(64);
