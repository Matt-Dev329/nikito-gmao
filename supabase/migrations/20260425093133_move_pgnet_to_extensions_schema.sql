/*
  # Move pg_net extension from public to extensions schema

  1. Changes
    - Drop pg_net from public schema (CASCADE drops its net.* objects)
    - Recreate pg_net in the extensions schema
    - The extension will recreate the `net` schema with all its functions
      (net.http_get, net.http_post, net.http_delete, net.http_collect_response)

  2. Impact
    - `call_roller_sync` references `net.http_post` which will be recreated
    - No data tables are affected (pg_net's queue table is ephemeral)
    - Cron jobs calling `call_roller_sync` will continue to work after
      the net schema is recreated

  3. Important notes
    - pg_net does not support ALTER EXTENSION SET SCHEMA, so drop+recreate
      is the only supported approach
*/

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
