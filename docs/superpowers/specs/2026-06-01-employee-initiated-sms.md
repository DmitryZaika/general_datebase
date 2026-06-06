# Employee-initiated SMS from the Edit Deal modal — Requirements & Acceptance

**Date:** 2026-06-01
**Branch:** `feat/sms-page` (continues the CloudTalk SMS feature)
**Status:** Requirements approved via clarifying Q&A (2026-06-01). Implementation plan pending user approval.
**Related:**
- [CloudTalk SMS finalization](../plans/2026-05-31-cloudtalk-sms-finalization.md) — forward-only Architecture A, the feature this builds on
- [Integration plan (iteration 2)](../iterations/02-integration-plan.md) — backend contract
- [Requirements](../../cloudtalk-integration-requirements.md) — original product spec

---

## 1. Goal

Let an employee **start a new SMS conversation** with a deal's customer directly from
the **Edit Deal** modal — not only view/reply to threads that already exist. Today the
SMS thread view is only reachable by clicking a row in the thread **list**, and the
thread list only contains phones that already have messages. There is no way to open a
conversation with a customer who has never been texted.

Entry point: the **Phone row** of the customer info table in the Edit Deal modal, at
`/admin/deals/edit/:id/project` and `/employee/deals/edit/:id/project`.

---

## 2. Verified current state (file:line)

| Fact | Evidence |
|---|---|
| Deal project view is a generic key/value `DataTable`; each customer field is one `{key,value}` row rendered by `AddressLinkCell` | [admin.deals.edit.$dealId.project.tsx:158-171](../../../app/routes/admin.deals.edit.$dealId.project.tsx#L158-L171), [employee...project.tsx:309-362](../../../app/routes/employee.deals.edit.$dealId.project.tsx#L309-L362) |
| Existing **mobile-only** `tel:` phone button (the thing to remove) | admin [:93-106](../../../app/routes/admin.deals.edit.$dealId.project.tsx#L93-L106); employee [:233-246](../../../app/routes/employee.deals.edit.$dealId.project.tsx#L233-L246) |
| Mobile detection via `useIsMobile()` (<768px), not CSS classes | both `AddressLinkCell` |
| Admin loader selects `c.phone` only; employee loader selects `c.phone` **and** `c.phone_2` | admin [:29](../../../app/routes/admin.deals.edit.$dealId.project.tsx#L29); employee [:58](../../../app/routes/employee.deals.edit.$dealId.project.tsx#L58) |
| Base detection helper | `getBase(pathname)` in [urlHelpers.ts:1-12](../../../app/utils/urlHelpers.ts#L1-L12) |
| SMS thread view returns **blank** for a phone with no messages | API loader returns `thread: null` ([api.cloudtalk.sms.thread.$phoneDigits.ts:24-30](../../../app/routes/api.cloudtalk.sms.thread.$phoneDigits.ts#L24-L30)); pane bails `if (!props.thread) return null` ([SmsConversationPane.tsx:143](../../../app/components/organisms/SmsPage/SmsConversationPane.tsx#L143)) |
| Composer needs only `phoneDigits` + `canSend` + `isSending` + `onSubmit` — no existing thread required | [SmsComposer.tsx:8-13](../../../app/components/organisms/SmsPage/SmsComposer.tsx#L8-L13) |
| `canSend` is `Boolean(user.cloudtalk_agent_id)` with **no role check** | thread loader [:27,:43](../../../app/routes/api.cloudtalk.sms.thread.$phoneDigits.ts#L27); send action [:32](../../../app/routes/api.cloudtalk.sms.send.ts#L32) |
| Admin/superuser CAN hold `cloudtalk_agent_id` (loaded for all roles) | [session.server.ts:92](../../../app/utils/session.server.ts#L92); `SessionUser` has `is_admin`,`is_superuser`,`cloudtalk_agent_id` [:27-38](../../../app/utils/session.server.ts#L27-L38) |
| Thread header customer name comes from `fetchCustomerByPhone` (joins **`cloudtalk_contacts`** only) | [cloudtalkSmsService.server.ts:458-474](../../../app/utils/cloudtalkSmsService.server.ts#L458-L474) |
| Phone helpers: `canonicalPhone10` (last 10), `phoneVariants` (10/11), `normalizeToE164`, `PHONE_DIGITS_REGEX = /^\d{10,15}$/` | [phone.ts:3,14,38,53](../../../app/utils/phone.ts#L3) |
| Outbound send already works (REST `sms/send.json`); employee gating on `cloudtalk_agent_id` | [api.cloudtalk.sms.send.ts](../../../app/routes/api.cloudtalk.sms.send.ts), [cloudtalkSendSms.server.ts](../../../app/utils/cloudtalkSendSms.server.ts) |

**Conclusion:** the *send* path already exists. The two real gaps are (a) the thread view
renders nothing for an empty/new conversation, and (b) there is no entry point to reach
it. This feature fixes both, plus the role-aware permission rule.

---

## 3. Decisions (confirmed with user 2026-06-01)

| # | Question | Decision |
|---|---|---|
| D1 | No / un-normalizable phone | If there is **no phone** (or fewer than 10 extractable digits), **disable** the button with a tooltip. If a phone exists but is just messily formatted, **normalize on our side** (strip to digits, take last 10) and enable. |
| D2 | Two phones (employee `phone` + `phone_2`) | **Per-row button**: each phone row gets its own SMS button targeting that row's own number. Admin only has the `phone` row. |
| D3 | Send permission | **Final (revised twice during dev testing 2026-06-01): agent-id only, any role/view.** `canSend = Boolean(cloudtalk_agent_id)`. Any user with a linked CloudTalk agent can send from either the admin or employee SMS view; without an agent id the conversation is read-only. (Superseded two earlier attempts: the `is_admin/is_superuser`-column rule, then the view-aware rule — both added needless friction. The user chose the simplest rule: linkage is the gate.) |
| D4 | Icon / placement | lucide **`MessageSquare`** icon, next to the `CopyText` in the phone row, visible on **both** mobile and desktop. On **desktop** also render the text label **"CloudTalk"**; mobile shows the icon only. |
| D5 | Branch | Continue on `feat/sms-page` (obvious default — all SMS work lives here). |

---

## 4. Functional requirements

### FR-1 — Remove the mobile `tel:` button
Remove the mobile-only `tel:` `<Link>` + lucide `PhoneIcon` block from **both** deal
project routes' `AddressLinkCell`, including any now-unused imports. No phone-call icon
remains anywhere in the phone row.

### FR-2 — New SMS button in the Phone row
- Rendered for `phone` (admin + employee) and `phone_2` (employee only) rows.
- Visible on **both** mobile and desktop (no `useIsMobile` gating of visibility).
- Desktop: `MessageSquare` icon + "CloudTalk" label. Mobile: icon only.
- Targets the **row's own** phone value (D2).

### FR-3 — Navigate to the SMS conversation (base-aware)
On click, navigate to the SMS thread page for the row's phone:
- Admin context → `/admin/cloudtalk/thread/:phoneDigits`
- Employee context → `/employee/cloudtalk/thread/:phoneDigits`
- Base resolved via `getBase(location.pathname)`.
- `:phoneDigits` = `canonicalPhone10(phoneValue)` (10 digits) so it satisfies
  `PHONE_DIGITS_REGEX` and matches existing thread keying.

### FR-4 — Phone validation / disabled state (D1)
- Extract digits from the raw phone value ourselves (handles `(317) 316-1456` etc.).
- If `canonicalPhone10` yields exactly 10 digits → button enabled, links to the thread.
- Otherwise (no phone / <10 digits) → button **disabled** with tooltip
  "No valid phone number on file" and no navigation.

### FR-5 — Usable empty / new conversation
Navigating to a thread for a phone with **no messages** must render a **usable**
conversation pane: a customer/phone header **and** an enabled composer (subject to
permissions), so the employee can type and send the **first** message. The first send is
a real CloudTalk outbound send (existing send path) and creates the thread.

### FR-6 — Send permission (final, per D3)
- **Any** user with a linked `cloudtalk_agent_id` can **read and send**, regardless of
  role/view; without an agent id the conversation is **read-only** (composer disabled).
- Enforced **server-side** on both the thread loader (`canSend`) and the send action
  via a single shared helper (`canUserSendSms`) so the rule cannot drift between read
  and write paths.
- (Supersedes the original "admin/superuser read-only" idea — see D3 in §3. The earlier
  role-column and view-aware variants were dropped because the only agent-linked user in
  practice is a superuser, and linkage is the real gate.)

### FR-7 — Existing conversation opens normally
If the customer already has a thread, the same navigation opens it with full history
(unchanged behavior).

---

## 5. Non-goals / out of scope
- No new inbound pipeline work (webhook/Lambda) — inbound depends on deploy/dashboard.
- No backfill of historical SMS (forward-only, per finalization doc).
- No "compose to an arbitrary phone" UI beyond the deal entry point.
- No DB migration (the schema already supports everything needed).
- No change to the thread **list** ordering/search.

---

## 6. Acceptance criteria

- [ ] Mobile `tel:` phone button is gone from both deal project routes; no dead imports; biome clean.
- [ ] An SMS (CloudTalk) button appears in the `phone` row (admin + employee) and `phone_2` row (employee), on **both** mobile and desktop.
- [ ] Desktop button shows `MessageSquare` + "CloudTalk"; mobile shows the icon only.
- [ ] Clicking it (employee) navigates to `/employee/cloudtalk/thread/<10-digits>`; (admin) to `/admin/cloudtalk/thread/<10-digits>`.
- [ ] Messily-formatted phones (`(317) 316-1456`) still navigate correctly (normalized our side).
- [ ] No phone / <10 digits → button disabled with a tooltip; no navigation.
- [ ] Opening a customer with **no** prior SMS shows a header + an **enabled** composer (employee with agent id) and an employee can send the first message; it persists and the thread appears.
- [ ] Opening a customer with existing SMS shows full history (unchanged).
- [ ] Admin/superuser sees the conversation but the composer is **disabled** (read-only), even if given an agent id; the send API rejects their send.
- [ ] Employee without an agent id sees the disabled composer (existing AgentNotLinked behavior), unchanged.
- [ ] `bunx biome check` clean and `bun run typecheck` clean on all touched files.
- [ ] Relevant `bun run test -- <file> --run` green (incl. new tests for empty-thread loader + role-aware `canSend`).
- [ ] No mock remnants: `rg -n "mock-service|mock-data|MOCK_SESSION|FAIL_PHONE_DIGITS" app/` → zero.
- [ ] Manual smoke: open a deal → click SMS button → empty conversation composer works end-to-end.
- [ ] Staged with explicit paths; **no commit** (user commits).

---

## 7. Open items to confirm in the plan (not blocking requirements)
- Whether to enhance `fetchCustomerByPhone` to also match `customers.phone`/`phone_2`
  directly (so a deal customer not yet in `cloudtalk_contacts` still shows their **name**
  in the empty-thread header instead of "Unlinked"). Proposed as a small, contained
  enhancement; see implementation plan.
