-- =============================================================================
-- Lonera scheduling schema - PostgreSQL 15+
--
-- STATUS: written, not yet executed. There was no Postgres instance available
-- when this was authored. The behaviour it encodes is exercised by
-- packages/core/src/booking.js and test/scheduling.test.js, which implement the
-- same state machine in-process; run this against a real database before
-- relying on it.
--
-- The one line this whole file exists for is `no_double_booking` on the
-- reservations table. Everything else supports it.
-- =============================================================================

create extension if not exists btree_gist;   -- lets `tutor_id with =` sit in a GiST exclusion
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- ----------------------------------------------------------------- people ----

create table users (
  id           uuid primary key default gen_random_uuid(),
  email        text unique,
  lang         text not null default 'en' check (lang in ('en', 'ko')),
  time_zone    text not null default 'America/Edmonton',
  created_at   timestamptz not null default now()
);

create table subjects (
  key          text primary key,                       -- 'organic_chemistry'
  parent_key   text references subjects (key),         -- 'chemistry'
  label_en     text not null,
  label_ko     text not null
);

create table providers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  time_zone    text not null default 'America/Edmonton',
  created_at   timestamptz not null default now()
);

create table tutors (
  id                       uuid primary key default gen_random_uuid(),
  provider_id              uuid not null references providers (id),
  display_name             text not null,
  display_name_ko          text,
  rating                   numeric(2, 1) check (rating between 0 and 5),
  languages                text[] not null default '{}',
  purposes                 text[] not null default '{}',   -- exam_prep, homework, recurring
  default_session_minutes  int not null default 60 check (default_session_minutes > 0),
  buffer_minutes           int not null default 0 check (buffer_minutes >= 0),
  min_lead_minutes         int not null default 120,
  location                 text,
  active                   boolean not null default true
);

create table tutor_subjects (
  tutor_id     uuid not null references tutors (id) on delete cascade,
  subject_key  text not null references subjects (key),
  primary key (tutor_id, subject_key)
);

-- ------------------------------------------------- when a tutor can work ----
-- Rules are the recurring shape of a week. Exceptions carve holidays out and
-- add one-off openings. Free slots are computed from these, minus external
-- busy time, minus reservations - never stored as rows, because a stored
-- "free slot" is a cached claim that goes stale the moment anything changes.

create table availability_rules (
  id           bigserial primary key,
  tutor_id     uuid not null references tutors (id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),   -- JS getDay()
  starts       time not null,
  ends         time not null,
  effective    daterange not null default daterange(current_date, null),
  check (ends > starts)
);

create table availability_exceptions (
  id           bigserial primary key,
  tutor_id     uuid not null references tutors (id) on delete cascade,
  during       tstzrange not null,
  kind         text not null check (kind in ('closed', 'extra_open')),
  note         text
);

-- Bumped by trigger on anything that changes a tutor's free time. Cache keys and
-- live-update streams carry this number, so a client can tell it missed an
-- update instead of trusting a quiet connection.
create table availability_versions (
  tutor_id     uuid primary key references tutors (id) on delete cascade,
  version      bigint not null default 0,
  changed_at   timestamptz not null default now()
);

-- ------------------------------------------------- external calendars ----
-- One table for both sides: a tutor's calendar tells us when they are busy; a
-- user's calendar tells us when THEY are busy and is where confirmed bookings
-- are written. Tokens are encrypted by the application with a KMS-held key
-- before they reach this table.

create table calendar_connections (
  id                     uuid primary key default gen_random_uuid(),
  owner_kind             text not null check (owner_kind in ('tutor', 'user')),
  owner_id               uuid not null,
  provider               text not null check (provider in ('google', 'microsoft', 'ics', 'device')),
  external_calendar_id   text,
  scopes                 text[] not null default '{}',
  access_token_enc       bytea,
  refresh_token_enc      bytea,
  token_expires_at       timestamptz,
  ics_url                text,                     -- read-only feeds only
  sync_token             text,                     -- Google incremental sync
  delta_link             text,                     -- Microsoft Graph delta
  etag                   text,                     -- ICS conditional GET
  last_synced_at         timestamptz,
  health                 text not null default 'ok' check (health in ('ok', 'stale', 'revoked', 'error')),
  created_at             timestamptz not null default now(),
  unique nulls not distinct (owner_kind, owner_id, provider, external_calendar_id)
);

-- Google watch channels and Graph subscriptions expire and must be renewed.
-- The token is stored hashed: it is what proves a webhook really came from us.
create table push_channels (
  id              text primary key,
  connection_id   uuid not null references calendar_connections (id) on delete cascade,
  resource_id     text,
  token_hash      bytea not null,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index push_channels_renew on push_channels (expires_at);

create table external_busy (
  id                  bigserial primary key,
  connection_id       uuid not null references calendar_connections (id) on delete cascade,
  external_event_id   text not null,
  during              tstzrange not null,
  updated_at          timestamptz not null default now(),
  unique (connection_id, external_event_id)
);
create index external_busy_range on external_busy using gist (connection_id, during);

-- ------------------------------------------------------- reservations ----
-- Holds and bookings share one table on purpose. An exclusion constraint only
-- sees rows in its own table, so if holds lived elsewhere, a hold and a booking
-- for the same half hour could both exist.

create table reservations (
  id                  uuid primary key default gen_random_uuid(),
  tutor_id            uuid not null references tutors (id),
  user_id             uuid not null references users (id),
  during              tstzrange not null,       -- the session itself
  blocked             tstzrange not null,       -- during, widened by the tutor's buffer
  status              text not null check (status in ('held', 'confirmed', 'cancelled', 'expired', 'released')),
  hold_expires_at     timestamptz,
  idempotency_key     text,
  version             int not null default 1,
  subject_key         text references subjects (key),
  purpose             text,
  search_context_id   uuid,
  replaced_by         uuid references reservations (id),
  created_at          timestamptz not null default now(),
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,

  check (not isempty(during) and lower_inc(during) and not upper_inc(during)),
  check (blocked @> during),
  check (status <> 'held' or hold_expires_at is not null),

  -- Two live reservations for one tutor cannot overlap. The database refuses
  -- the second INSERT with SQLSTATE 23P01 no matter how many app servers race,
  -- which is the only double-booking guarantee that survives more than one
  -- process. Note that it fires at HOLD time: the moment User A picks 5:00 PM,
  -- User B's hold on it is impossible, which is exactly when the brief says the
  -- slot must become unavailable.
  constraint no_double_booking
    exclude using gist (tutor_id with =, blocked with &&)
    where (status in ('held', 'confirmed'))
);

create unique index reservations_idempotency
  on reservations (user_id, idempotency_key) where idempotency_key is not null;
create index reservations_expiring on reservations (hold_expires_at) where status = 'held';
create index reservations_by_user on reservations (user_id, status);

create table reservation_events (
  id               bigserial primary key,
  reservation_id   uuid not null references reservations (id),
  type             text not null,     -- held, confirmed, cancelled, rescheduled, expired, taken_upstream
  actor            text not null,     -- user, tutor, system, provider
  detail           jsonb not null default '{}',
  at               timestamptz not null default now()
);

-- ------------------------------------------------ calendar delivery ----
-- One row per place a booking should appear. The worker compares
-- synced_version with the reservation's version and does whatever
-- calendar.nextCalendarOp() says: insert, update, delete or nothing.

create table calendar_links (
  id                  bigserial primary key,
  reservation_id      uuid not null references reservations (id) on delete cascade,
  connection_id       uuid references calendar_connections (id) on delete cascade,
  delivery            text not null check (delivery in
                        ('google_api', 'microsoft_graph', 'ics_email', 'webcal_feed', 'device_eventkit')),
  external_event_id   text,
  sequence            int not null default -1,
  synced_version      int not null default -1,
  state               text not null default 'none' check (state in ('none', 'created', 'deleted', 'failed')),
  last_error          text,
  updated_at          timestamptz not null default now(),
  unique nulls not distinct (reservation_id, delivery, connection_id)
);

create table calendar_feeds (
  user_id       uuid primary key references users (id) on delete cascade,
  token_hash    bytea not null unique,   -- the webcal URL carries the token; we keep only its hash
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz
);

-- ----------------------------------------------------------- outbox ----
-- Calendar writes, emails and live-update fan-out are written here in the SAME
-- transaction as the booking change, then delivered by a worker. A booking can
-- therefore never be confirmed without its calendar work being queued, and a
-- Google outage delays the calendar event instead of failing the booking.

create table outbox (
  id              bigserial primary key,
  topic           text not null,          -- booking.confirmed, booking.cancelled, slot.taken ...
  aggregate_id    uuid not null,
  payload         jsonb not null,
  available_at    timestamptz not null default now(),
  attempts        int not null default 0,
  locked_until    timestamptz,
  last_error      text,
  done_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index outbox_ready on outbox (available_at) where done_at is null;

-- --------------------------------------------------- conversation state ----
-- "What's available?" is answered from here, not from a fresh parse.

create table search_contexts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users (id) on delete cascade,
  preferences      jsonb not null,          -- normalized constraints, hard and soft
  last_utterance   text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '7 days'
);

-- ------------------------------------------------------- standby line ----
-- An identity column gives a total order that two joins in the same
-- millisecond cannot tie on.

create table standby_entries (
  seq          bigint generated always as identity primary key,
  tutor_id     uuid not null references tutors (id) on delete cascade,
  during       tstzrange not null,
  user_id      uuid not null references users (id) on delete cascade,
  auto_book    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (tutor_id, during, user_id)
);

-- =============================================================================
-- The three statements that matter, as the API server runs them.
-- =============================================================================

-- HOLD  (POST /api/reservations)
--   begin;
--   update reservations set status = 'expired', version = version + 1
--    where tutor_id = $1 and status = 'held' and hold_expires_at <= now() and blocked && $4;
--   select count(*) from reservations where user_id = $2 and status = 'held' and hold_expires_at > now();
--     -- >= 2 : 429 too_many_holds
--   insert into reservations (tutor_id, user_id, during, blocked, status, hold_expires_at)
--   values ($1, $2, $3, $4, 'held', now() + interval '3 minutes')
--   returning id, hold_expires_at, version;
--     -- SQLSTATE 23P01 : 409 slot_unavailable
--   insert into outbox (topic, aggregate_id, payload) values ('slot.held', $1, ...);
--   commit;

-- CONFIRM  (POST /api/reservations/:id/confirm, Idempotency-Key header)
--   0. select * from reservations where user_id = $2 and idempotency_key = $3;
--        -- a row: return it (replay)
--   1. OUTSIDE any transaction: ask the provider's live system if the range is free.
--        -- unreachable: 503 provider_unreachable, hold kept
--        -- busy:        release the hold, 409 taken_upstream, return alternatives
--   2. begin;
--      update reservations
--         set status = 'confirmed', confirmed_at = now(), idempotency_key = $3, version = version + 1
--       where id = $1 and user_id = $2 and status = 'held'
--         and hold_expires_at > now() and version = $4
--      returning *;
--        -- 0 rows: the hold expired or changed during step 1 -> 409 hold_expired
--      insert into outbox (topic, aggregate_id, payload) values ('booking.confirmed', $1, ...);
--      insert into calendar_links (reservation_id, connection_id, delivery) select ...;
--      commit;
--   The provider call stays outside the transaction so a slow Google response
--   never holds a row lock; the version check in step 2 is what makes that safe.

-- CANCEL  (POST /api/bookings/:id/cancel)
--   begin;
--   update reservations set status = 'cancelled', cancelled_at = now(), version = version + 1
--    where id = $1 and user_id = $2 and status = 'confirmed' returning *;
--   insert into outbox (topic, aggregate_id, payload) values ('booking.cancelled', $1, ...);
--   commit;
--   The standby worker consumes booking.cancelled and offers the range to the
--   lowest seq in standby_entries, through the same HOLD statement above.
