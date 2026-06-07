# CloudTalk SMS — Finalization (Architecture A, forward-only) + P0/P1 fixes

**Date:** 2026-05-31
**Branch:** `feat/sms-page` (CRM) + matching branch in `granite-webhooks`
**Status:** Approved scope = P0 + P1. P2/P3 documented as follow-ups. Single CRM commit made by the user at the end; never `git commit`; stage explicit paths only.

---

## 1. Architecture decision (verified)

**Architecture A — webhook (inbound) + DB-store + REST send (outbound) — is the only feasible design**, and is retained.

CloudTalk exposes **no SMS-read API**. Verified two ways:
- Live probe with company 1's real Basic-auth creds: `sms/index.json`, `messages/index.json` + 11 other paths → **404**; `calls/index.json` (62), `contacts/index.json` (4240), `agents/index.json` (3), `campaigns/index.json` → **200**.
- Deep research fetched CloudTalk's OpenAPI spec v1.7 (`developers.cloudtalk.io/swagger.json`): **56 endpoints; the only SMS endpoint is `POST /sms/send.json`.** No list/history/index/inbox/thread endpoint exists anywhere.

Therefore Architectures B (live-pull) and C (hybrid) are **not buildable**. The DB is necessarily the source of truth.

### History (old dialog) — verdict: forward-only
- Analytics "Messages Report" + CSV export = **aggregate-only** (counts, per-country cost, per-agent totals). No bodies/direction/numbers/timestamps.
- CloudTalk's first-party CRM integrations (HubSpot/Salesforce/Pipedrive/Zoho) sync SMS **forward-only** from connection date (CloudTalk doc 14665732); only **contacts** get an initial import. The in-CRM "full thread" is their embedded widget, not extractable records.
- Only residual path for historical content: a **manual CloudTalk Support export request** — CloudTalk does *not* document whether it returns message content; only Support can confirm. **Do not architect around it.**

**Implication:** the CRM shows SMS **from integration date forward** (whatever the webhook captures + what we send). Pre-integration dialogs (e.g. Dmytro's existing history) are **not recoverable** except via a best-effort Support ticket.

---

## 2. Why the live table is empty (diagnosis)

`anya_db.cloudtalk_sms` = 0 rows, but Dmytro has many SMS in CloudTalk. Cause: those were sent inside CloudTalk and **never entered our DB** (no webhook capture), and there is no API to backfill. Ruled out: migrations-not-applied (all 5 applied), guard-rejects (guard never rejects). Remaining live-pipeline causes (need user's AWS/dashboard to close):
1. CloudTalk dashboard SMS-received webhook not configured / wrong URL or body template.
2. Deployed Lambda is the OLD code (the `i32` PK overflow on CloudTalk's ~2.2e9 ids) — staged fix not yet deployed.
3. Deployed Lambda's `DATABASE_URL` may not point at `anya_db` (local `.env` shows `localhost/main2`).

These are **deployment/config** items, not code-logic; tracked in §5.

---

## 3. Correctness audit summary

8-dimension adversarial audit: 57 findings, **32 confirmed**. Fixing **P0 (2) + P1 (~9)** now; P2/P3 deferred (§6).

---

## 4. P0 + P1 fix list (this change)

### P0 — Critical
| # | Bug | Files | Fix |
|---|---|---|---|
| P0-1 | Mark-read is dead code → unread badge never clears (thread loader hardcodes `unreadCount: 0`; client only fires mark-read when `!= 0`) | `api.cloudtalk.sms.thread.$phoneDigits.ts`, `cloudtalkSmsService.server.ts` | Add `getThreadUnreadCountForUser(user, phoneDigits)`; loader returns the real count |
| P0-2 | Inbound webhook unauthenticated (`MarketingUser` returns `Ok` on every path; it also guards WordPress/Facebook/new-lead webhooks) | `granite-webhooks/.../guards.rs`, `cloudtalk/receive.rs` | Added a dedicated strict `CloudTalkWebhookUser` guard for the SMS route ONLY (rejects missing/invalid/mismatched bearer; 403). `MarketingUser` left permissive for the 3 marketing webhooks. **Requires the dashboard webhook to send the Bearer token — see §5.** Rust unverified locally (no MySQL) → needs `cargo test`. |

### P1 — High
| # | Bug | Files | Fix |
|---|---|---|---|
| P1-1 | Phone-format split: inbound stored last-10, outbound stored full digits → threads split; read-marker/unread keys mismatch | `phone.ts`, `cloudtalkSmsService.server.ts` | Add `canonicalPhone10()`; store outbound `recipient` + read-marker as last-10 (matches Rust) |
| P1-2 | Customer LEFT JOIN duplicates threads when two numbers share last-10 | `cloudtalkSmsService.server.ts` | De-dup the contact join (pick one customer per thread) |
| P1-3 | `/admin/cloudtalk` gated at employee tier | `admin.cloudtalk.tsx`, `admin.cloudtalk.thread.$phoneDigits.tsx` | Own loader using `getAdminUser` |
| P1-4 | CloudTalk HTTP-200-with-error-body recorded as `sent` | `cloudtalkSendSms.server.ts` | Detect error envelope in 200 body → throw `CloudTalkApiError` |
| P1-5 | Customer/Deal timelines show `pending`/`failed` outbound as "Sent" | `cloudtalkSms.server.ts`, `smsDisplayHelpers.ts` | Select `status`+`direction`; exclude `pending`/`failed`; use authoritative `direction` |
| P1-6 | `CleanedPhone` panics (HTTP 500) on <10-digit phones | `granite-webhooks/.../schemas.rs` | Return a deserialize error (graceful 422) instead of `.unwrap()` |
| P1-7 | Cross-thread state leak (reset effect `[]` deps; child route no `key`) | `employee.cloudtalk.thread.$phoneDigits.tsx` | Reset on `phoneDigits` change |
| P1-8 | Echo-dedupe broken for inbound `id:null` (unique key ignores NULLs) | dashboard template + `crud/cloudtalk.rs` | Require dashboard template to include the SMS id (§5); code keeps `INSERT IGNORE` |
| P1-9 | Employee visibility rests on free-form `agent` string (shared/misassigned id leaks threads) | docs + data | Documented constraint: agent ids unique-per-user; remove Anna's borrowed `540273` |

---

## 5. Deployment / dashboard coordination (user actions — not code)

1. **Deploy granite-webhooks** with the staged fixes so the live Lambda has `cloudtalk_id BIGINT` + `INSERT IGNORE` + (new) strict guard + CleanedPhone fix.
2. **Set the Lambda `DATABASE_URL`** (AWS console) to the RDS `anya_db` — not `localhost/main2`.
3. **CloudTalk dashboard webhook** on the SMS-receiving number(s): POST to `<lambda-url>/cloudtalk/sms/1` with header `Authorization: Bearer 9ca4dfa8-0eec-46cc-967f-3385624be883` (the guard's `CORRECT_ID`) and a body template that includes the message **id**, `sender`, `recipient`, `[text]`-marked body, and `agent`. **Without the Bearer token the new strict guard will reject** — token + deploy must land together.

---

## 6. Deferred (P2/P3 — documented, not fixed now)

Read-marker/unread-count key edge cases beyond P1-1, brittle inbound parser, error-token swallowing in UI, `idempotency_key` lacks UNIQUE constraint, retry double-send, PostHog-on-hot-path, raw-bearer logging, unbounded offset, per-process rate-limiter, date-parse hardening, `MockCustomer` rename, etc. (~46 items). To be scheduled after the pipeline is live.

---

## 7. Acceptance checklist

- [ ] P0/P1 code fixes implemented in reviewable chunks; biome + typecheck clean on every touched file.
- [ ] `bun run test -- app/utils/cloudtalkSmsService.test.ts app/utils/cloudtalkSendSms app/utils/userRateLimiter app/routes/api.emails.unread-count.test.ts --run` green; new tests added for P0-1, P1-1, P1-4, P1-5.
- [ ] No mock remnants: `rg -n "mock-service|mock-data|MOCK_SESSION|setMockAgentLinked|setMockIsAdmin|__resetMockState|FAIL_PHONE_DIGITS|useSmsStoreInvalidation|SmsAccessUser" app/` → zero.
- [ ] granite-webhooks: `cargo test --package webhooks cloudtalk` green (run by user / where MySQL available).
- [ ] §5 deployment + dashboard steps completed and an inbound test SMS lands a row; one outbound send verified live.
- [ ] Single CRM commit by the user; granite-webhooks staged separately.
