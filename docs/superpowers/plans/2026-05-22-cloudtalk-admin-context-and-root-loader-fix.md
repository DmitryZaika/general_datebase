# CloudTalk SMS — Admin Context Fix + Root Loader Speedup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two production-impacting bugs introduced by (or surfaced alongside) the CloudTalk SMS feature — (1) admins lose admin context when they click "CloudTalk SMS"; (2) every page navigation runs ~10 sequential DB queries in the root loader.

**Architecture:**
- **Problem 1 (admin context)** — keep one canonical route implementation (`employee.cloudtalk.*`). Add thin sibling route files under `admin.cloudtalk.*` that simply re-export `loader` / `default` / `action`. Make sidebar link and in-page navigation base-aware (derive `/admin` vs `/employee` from current location).
- **Problem 2 (root loader speed)** — leave the session/permission path strictly serial (it gates everything else). Run the 4 independent reference-data lookups (`colors`, stone/sink/faucet suppliers) concurrently via `Promise.all`. Gate `unreadEmailCount` on routes that show the badge, and move the badge to a client-side TanStack Query (mirroring the `SidebarCloudtalkBadge` pattern that already exists).
- **Problem 3 (admin visibility)** — verification only; no code.

**Tech Stack:** React Router v7 (flatRoutes), TypeScript, MySQL via `mysql2/promise`, TanStack Query, Vitest with real MySQL, Biome.

**Non-goals (do NOT touch):**
- `cloudtalkSmsService.server.ts` visibility logic
- CloudTalk send / webhook code
- DB migrations (already applied)
- Session / superadmin / company-switch logic in `root.tsx`
- Any of the deferred items (G-1, G-2, M-5/6/8/9/12)

**Repo / branch:** `/Users/annakuhir/Desktop/new/general_datebase`, branch `fix/sinc-issues`. No changes to `granite-webhooks`.

**Final commit:** the user commits manually at the end. Stage with explicit `git add <path>`. **Never** run `git commit` in this plan.

---

## File map

**New files (CRM repo):**
- `app/routes/admin.cloudtalk.tsx` — re-exports `loader` + `default` from `./employee.cloudtalk`
- `app/routes/admin.cloudtalk.thread.$phoneDigits.tsx` — re-exports `loader` + `default` from `./employee.cloudtalk.thread.$phoneDigits` (no `action` exists; do not export one)
- `app/routes/api.emails.unread-count.ts` — GET endpoint returning `{ count }` for the current user

**Modified files (CRM repo):**
- `app/components/molecules/Sidebars/EmployeeSidebar.tsx` — base-aware CloudTalk URL; switch unread-email badge to a client-side hook
- `app/routes/employee.cloudtalk.tsx` — base-aware thread navigation
- `app/root.tsx` — `Promise.all` for independent queries, gate `unreadEmailCount` to relevant routes, optionally hand the count to the sidebar as `undefined` for fully client-managed routes
- `app/components/organisms/SmsPage/service.ts` — add `fetchUnreadEmailCount()` (small helper; sits next to the existing `fetchUnreadCount` for SMS)

**Out of scope (verification only):**
- `app/utils/cloudtalkSmsService.server.ts` (`buildVisibilityClause`) — read to confirm admin sees all; do not modify

---

## Task 1: Add `/admin/cloudtalk` parallel route

**Files:**
- Create: `app/routes/admin.cloudtalk.tsx`

- [ ] **Step 1: Create the admin parent route as a thin re-export**

Create `app/routes/admin.cloudtalk.tsx` with exactly:

```ts
export { default, loader } from './employee.cloudtalk'
```

Rationale: `employee.cloudtalk.tsx` calls `getEmployeeUser`, which already permits admins and superusers (see `app/utils/session.server.ts:197-202`). No action export exists on that file. The page renders the two-pane layout with an `<Outlet />` for the thread child route.

- [ ] **Step 2: Stage**

```bash
git add app/routes/admin.cloudtalk.tsx
```

---

## Task 2: Add `/admin/cloudtalk/thread/$phoneDigits` parallel route

**Files:**
- Create: `app/routes/admin.cloudtalk.thread.$phoneDigits.tsx`

- [ ] **Step 1: Create the admin thread route as a thin re-export**

Create `app/routes/admin.cloudtalk.thread.$phoneDigits.tsx` with exactly:

```ts
export { default, loader } from './employee.cloudtalk.thread.$phoneDigits'
```

Rationale: the employee thread file exports `loader` and `default`, no `action` (verified — submissions happen via fetch to `/api/cloudtalk/sms/*`).

- [ ] **Step 2: Stage**

```bash
git add app/routes/admin.cloudtalk.thread.$phoneDigits.tsx
```

---

## Task 3: Make the sidebar CloudTalk URL base-aware

**Files:**
- Modify: `app/components/molecules/Sidebars/EmployeeSidebar.tsx:147-153`

- [ ] **Step 1: Switch hardcoded URL to base-aware**

Replace lines 147-153:

```tsx
if (['admin', 'employee'].includes(base)) {
  finalList.push({
    title: 'CloudTalk SMS',
    url: `/employee/cloudtalk`,
    icon: MessageSquare,
  })
}
```

With:

```tsx
if (['admin', 'employee'].includes(base)) {
  finalList.push({
    title: 'CloudTalk SMS',
    url: `/${base}/cloudtalk`,
    icon: MessageSquare,
  })
}
```

`base` here is already filtered to `'admin' | 'employee'` for this entry, so this produces `/admin/cloudtalk` for admins and `/employee/cloudtalk` for employees.

- [ ] **Step 2: Stage**

```bash
git add app/components/molecules/Sidebars/EmployeeSidebar.tsx
```

(Note: this file gets more edits in Task 8 for the unread-email badge. If you reach this point and intend to also do Task 8 before staging, you can defer staging until both edits land.)

---

## Task 4: Make in-page thread navigation base-aware

**Files:**
- Modify: `app/routes/employee.cloudtalk.tsx:78-81`

- [ ] **Step 1: Read current `useNavigate` call**

Verify the current code at lines 78-81 reads:

```tsx
const handleSelect = useCallback(
  (phone: string) => navigate(`/employee/cloudtalk/thread/${phone}`),
  [navigate],
)
```

- [ ] **Step 2: Make the path base-aware via `useLocation`**

Replace with:

```tsx
const location = useLocation()
const cloudtalkBase = location.pathname.startsWith('/admin')
  ? '/admin/cloudtalk'
  : '/employee/cloudtalk'

const handleSelect = useCallback(
  (phone: string) => navigate(`${cloudtalkBase}/thread/${phone}`),
  [navigate, cloudtalkBase],
)
```

Add `useLocation` to the imports from `'react-router'` at the top of the file:

```tsx
import {
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
```

- [ ] **Step 3: Audit the rest of the file for any other hardcoded `/employee/cloudtalk` literals**

Run:

```bash
rg -n "/employee/cloudtalk" app/routes/employee.cloudtalk.tsx
```

Expected: only the import-level mention (none in the new code). If any other hardcoded `/employee/cloudtalk` remains in the file (e.g., links inside the JSX, link helpers passed to child components), convert them to `${cloudtalkBase}/...` the same way.

Also audit the child thread route and the link-customer dialog — `useNavigate` / `Link` / `redirect` calls only:

```bash
rg -n "(navigate\(|<Link |to=\"|redirect\()" app/routes/employee.cloudtalk.thread.$phoneDigits.tsx app/components/organisms/SmsPage/SmsLinkCustomerDialog.tsx
```

Confirm both files perform no client-side navigation that would push the user to `/employee/cloudtalk` or `/admin/cloudtalk`. The thread route does not navigate; the dialog only calls `props.onClose()` / `props.onLinked()` — both invalidate TanStack Query keys without changing the URL.

- [ ] **Step 4: Stage**

```bash
git add app/routes/employee.cloudtalk.tsx
```

---

## Task 5: Parallelize independent root-loader queries

**Files:**
- Modify: `app/root.tsx:155-199`

- [ ] **Step 1: Replace serial query block with `Promise.all`**

Current code (lines 155-199):

```tsx
let stoneSuppliers: ISupplier[] | undefined
let sinkSuppliers: ISupplier[] | undefined
let faucetSuppliers: ISupplier[] | undefined
let position: string | null = null
let unreadEmailCount = 0

const colors = await selectMany<{ id: number; name: string; hex_code: string }>(
  db,
  `SELECT c.id, c.name, c.hex_code
    FROM colors c
    ORDER BY c.name ASC`,
  [],
)

if (companyId !== undefined) {
  stoneSuppliers = await selectMany<ISupplier>(
    db,
    `SELECT s.id, s.supplier_name
     FROM suppliers s
     INNER JOIN stones st ON s.id = st.supplier_id
     WHERE s.company_id = ?
     GROUP BY s.id, s.supplier_name`,
    [companyId],
  )

  sinkSuppliers = await selectMany<ISupplier>(
    db,
    `SELECT s.id, s.supplier_name
     FROM suppliers s
     INNER JOIN sink_type sk ON s.id = sk.supplier_id
     WHERE s.company_id = ?
     GROUP BY s.id, s.supplier_name`,
    [companyId],
  )

  faucetSuppliers = await selectMany<ISupplier>(
    db,
    `SELECT s.id, s.supplier_name
     FROM suppliers s
     INNER JOIN faucet_type ft ON s.id = ft.supplier_id
     WHERE s.company_id = ?
     GROUP BY s.id, s.supplier_name`,
    [companyId],
  )
}
```

Replace with a single `Promise.all` that fans the four queries out in parallel:

```tsx
let stoneSuppliers: ISupplier[] | undefined
let sinkSuppliers: ISupplier[] | undefined
let faucetSuppliers: ISupplier[] | undefined
let position: string | null = null

const colorsPromise = selectMany<{ id: number; name: string; hex_code: string }>(
  db,
  `SELECT c.id, c.name, c.hex_code
    FROM colors c
    ORDER BY c.name ASC`,
  [],
)

const stoneSuppliersPromise =
  companyId !== undefined
    ? selectMany<ISupplier>(
        db,
        `SELECT s.id, s.supplier_name
         FROM suppliers s
         INNER JOIN stones st ON s.id = st.supplier_id
         WHERE s.company_id = ?
         GROUP BY s.id, s.supplier_name`,
        [companyId],
      )
    : Promise.resolve(undefined)

const sinkSuppliersPromise =
  companyId !== undefined
    ? selectMany<ISupplier>(
        db,
        `SELECT s.id, s.supplier_name
         FROM suppliers s
         INNER JOIN sink_type sk ON s.id = sk.supplier_id
         WHERE s.company_id = ?
         GROUP BY s.id, s.supplier_name`,
        [companyId],
      )
    : Promise.resolve(undefined)

const faucetSuppliersPromise =
  companyId !== undefined
    ? selectMany<ISupplier>(
        db,
        `SELECT s.id, s.supplier_name
         FROM suppliers s
         INNER JOIN faucet_type ft ON s.id = ft.supplier_id
         WHERE s.company_id = ?
         GROUP BY s.id, s.supplier_name`,
        [companyId],
      )
    : Promise.resolve(undefined)

const [colors, stoneSuppliersResult, sinkSuppliersResult, faucetSuppliersResult] =
  await Promise.all([
    colorsPromise,
    stoneSuppliersPromise,
    sinkSuppliersPromise,
    faucetSuppliersPromise,
  ])

stoneSuppliers = stoneSuppliersResult
sinkSuppliers = sinkSuppliersResult
faucetSuppliers = faucetSuppliersResult
```

Note: the `unreadEmailCount` initialization is deliberately removed here — Task 6 moves it out of this block entirely. Leave it removed.

- [ ] **Step 2: Run typecheck on the touched file**

```bash
bun run typecheck
```

Expected: 0 new errors. If you see "variable declared but never read" for `unreadEmailCount`, that's the next task — proceed.

---

## Task 6: Drop `unreadEmailCount` from the root loader; serve via new API route

**Files:**
- Modify: `app/root.tsx` (remove the in-loader query + the field from the returned `data(...)`)
- Create: `app/routes/api.emails.unread-count.ts`

- [ ] **Step 1: Remove the in-loader query block**

In `app/root.tsx`, find and delete the block starting around line 201 (`if (user) { … const userEmail = … unreadEmailRows = await selectMany … unreadEmailCount = … }`) — keep the **position** lookup that follows directly after, and keep all the redirect logic for installer / check-in / external marketing / shop worker. Only delete the unread-email computation.

After deletion the `if (user) { ... }` block should look like:

```tsx
if (user) {
  const [rows] = await db.query<(RowDataPacket & { position: string })[]>(
    `SELECT p.name AS position
     FROM users u
     LEFT JOIN users_positions up ON up.user_id = u.id
     LEFT JOIN positions p ON p.id = up.position_id
     WHERE u.id = ? AND p.name IN ('external_marketing','check-in','installer','shop_worker') AND u.is_deleted = 0`,
    [user.id],
  )
  // ... (unchanged: hasCheckIn / hasExternalMarketing / hasInstaller / hasShopWorker derivations and redirects)
}
```

- [ ] **Step 2: Remove `unreadEmailCount` from the returned `data(...)` payload**

In the `return data({ ... })` call (around line 287), drop the `unreadEmailCount,` field. The remaining payload keeps `message`, `token`, `user`, `companyName`, `stoneSuppliers`, `sinkSuppliers`, `faucetSuppliers`, `colors`, `position`, `superadminCompanies`, `activeCompanyId`, `userIsSuperAdmin`.

- [ ] **Step 3: Remove the `RowDataPacket` import only if it's now unused**

Run:

```bash
rg -n "RowDataPacket" app/root.tsx
```

If the position-lookup query still uses it (it does), keep the import. Otherwise remove from the import list.

- [ ] **Step 4: Create the new API endpoint**

Create `app/routes/api.emails.unread-count.ts`:

```ts
import type { LoaderFunctionArgs } from 'react-router'
import { data } from 'react-router'
import { db } from '~/db.server'
import { handleAuthError } from '~/utils/apiResponse.server'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getEmployeeUser(request)
    const userEmail =
      typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
    const userEmailLike = `%<${userEmail}>`

    const rows = await selectMany<{ c: number }>(
      db,
      `SELECT COUNT(DISTINCT e.thread_id) AS c
       FROM emails e
       LEFT JOIN (
         SELECT thread_id, MAX(deal_id) AS deal_id
         FROM emails
         WHERE deleted_at IS NULL AND thread_id IS NOT NULL AND deal_id IS NOT NULL
         GROUP BY thread_id
       ) td ON td.thread_id = e.thread_id
       LEFT JOIN deals d ON d.id = COALESCE(e.deal_id, td.deal_id) AND d.deleted_at IS NULL
       WHERE e.deleted_at IS NULL
         AND e.thread_id IS NOT NULL
         AND e.sender_user_id IS NULL
         AND e.employee_read_at IS NULL
         AND (
           e.receiver_user_id = ?
           OR d.user_id = ?
           OR LOWER(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(e.receiver_email, '<', -1), '>', 1))) = ?
           OR (e.receiver_email NOT LIKE '%<%' AND LOWER(TRIM(e.receiver_email)) = ?)
           OR e.receiver_email LIKE ?
         )`,
      [user.id, user.id, userEmail, userEmail, userEmailLike],
    )
    const count = rows[0]?.c ?? 0
    return data({ count })
  } catch (err) {
    return handleAuthError(err)
  }
}
```

This is a verbatim lift of the query from the old root loader.

- [ ] **Step 5: Stage**

```bash
git add app/root.tsx app/routes/api.emails.unread-count.ts
```

---

## Task 7: Add `fetchUnreadEmailCount()` client helper

**Files:**
- Modify: `app/components/organisms/SmsPage/service.ts` (append)

Reasoning for location: this `service.ts` is already the home of `fetchUnreadCount()` for SMS — adding the email helper alongside keeps both badge-count fetchers in one file. Alternative is a separate `emails-service.ts`; we choose colocation to minimize new files. The function lives in a folder named `SmsPage`, which is technically slightly misleading, but creating a parallel file for one tiny function is over-engineering. Add a brief grouping comment.

- [ ] **Step 1: Append the helper**

Add at the bottom of `app/components/organisms/SmsPage/service.ts`:

```ts
export async function fetchUnreadEmailCount(): Promise<{ count: number }> {
  const res = await fetch('/api/emails/unread-count', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`fetch_unread_email_count_failed:${res.status}`)
  return (await res.json()) as { count: number }
}
```

- [ ] **Step 2: Stage**

```bash
git add app/components/organisms/SmsPage/service.ts
```

---

## Task 8: Switch the sidebar's unread-email badge to client-side query

**Files:**
- Modify: `app/components/molecules/Sidebars/EmployeeSidebar.tsx`

- [ ] **Step 1: Add a client-side hook for the count**

At the top of the file, add the `useQuery` import (it may already be present — check first):

```tsx
import { useQuery } from '@tanstack/react-query'
import { fetchUnreadEmailCount } from '~/components/organisms/SmsPage/service'
```

Inside `EmployeeSidebar(...)` (the function component around line 284), replace:

```tsx
const unreadEmailCount = data?.unreadEmailCount ?? 0
```

with:

```tsx
const unreadEmailQuery = useQuery({
  queryKey: ['unread-email-count'],
  queryFn: fetchUnreadEmailCount,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  // Skip on routes that don't render the email badge — see Task 9 if you choose
  // route-level gating instead. Default: always fetch; cheap when the badge isn't shown.
  enabled:
    base === 'employee' || base === 'admin' || base === 'customer',
})
const unreadEmailCount = unreadEmailQuery.data?.count ?? 0
```

Also remove `unreadEmailCount?: number` from the inline `useLoaderData<…>()` type definition (around line 294-306) — the field is no longer in the loader payload.

- [ ] **Step 2: Stage**

```bash
git add app/components/molecules/Sidebars/EmployeeSidebar.tsx
```

---

## Task 9: Verify nothing else depended on the loader field

**Files:**
- Audit-only

- [ ] **Step 1: Grep the codebase for stale references**

```bash
rg -n "unreadEmailCount" app/
```

Expected: zero matches except inside `EmployeeSidebar.tsx`'s new client-side block. If the Header (`app/components/Header.tsx`) or any other component reads `unreadEmailCount` from `useRouteLoaderData('root')` / `useLoaderData`, update it to use the same `useQuery` hook (extract to a small custom hook if you find a second consumer — DRY).

```bash
rg -n "useRouteLoaderData|useLoaderData" app/components/Header.tsx app/components/MarketingHeader.tsx 2>/dev/null | head -20
```

Expected: no references to `unreadEmailCount`. If any exist, refactor them to the client-side hook before finishing.

---

## Task 10: Verification suite

**Files:**
- Run-only

- [ ] **Step 1: Hard-fail rule — no mock data added back**

```bash
rg -n "mock-service|mock-data|MOCK_SESSION|setMockAgentLinked|setMockIsAdmin|__resetMockState|FAIL_PHONE_DIGITS|useSmsStoreInvalidation|SmsAccessUser" app/
```

Expected: zero matches.

- [ ] **Step 2: Biome check on every touched file**

```bash
bunx biome check \
  app/routes/admin.cloudtalk.tsx \
  app/routes/admin.cloudtalk.thread.$phoneDigits.tsx \
  app/routes/employee.cloudtalk.tsx \
  app/routes/api.emails.unread-count.ts \
  app/root.tsx \
  app/components/molecules/Sidebars/EmployeeSidebar.tsx \
  app/components/organisms/SmsPage/service.ts
```

Expected: 0 errors. Auto-fix anything trivial (single-quote, no-semicolons) with:

```bash
bunx biome check --write <files>
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: no new errors. If the project has pre-existing errors unrelated to the touched files, note them but don't fix.

- [ ] **Step 4: Run the SMS test suite**

```bash
bun run test -- app/utils/cloudtalkSms app/utils/cloudtalkSendSms app/utils/userRateLimiter --run
```

Expected: all pass (the previously-noted transient mysql2 prepared-statement-cache flake is known harmless — if it happens, rerun per-file to confirm).

- [ ] **Step 5: Confirm the admin visibility path is unchanged**

```bash
rg -n "buildVisibilityClause" app/utils/cloudtalkSmsService.server.ts
```

Read the function body — confirm it still returns `{ sql: '', params: [] }` for `user.is_admin || user.is_superuser`. **Do not change the file.** This is the Problem 3 sanity check.

- [ ] **Step 6: Confirm git state**

```bash
cd /Users/annakuhir/Desktop/new/general_datebase && git status --short
cd /Users/annakuhir/Desktop/new/granite-webhooks && git status --short
```

Expected: CRM repo shows staged changes for the files in the file map; `granite-webhooks` is untouched relative to its starting state (no new changes from this plan).

- [ ] **Step 7: Manual smoke (best-effort)**

If a dev server is reachable:

1. Log in as admin → navigate to `/admin/stones`.
2. Click "CloudTalk SMS" in the sidebar.
3. Confirm URL = `/admin/cloudtalk`.
4. Confirm sidebar still shows admin items (Stones, Sinks, Faucets, Suppliers, Customers, Statistic, Deals, Emails, …).
5. Click any thread row; confirm URL becomes `/admin/cloudtalk/thread/<digits>` and the sidebar mode is still admin.
6. Log in as employee → navigate to `/employee/stones`. Click "CloudTalk SMS". Confirm URL = `/employee/cloudtalk`, behavior unchanged.

If no dev server is available, mark this step as "pending — to be confirmed by the user before the manual commit" in the final report.

---

## Final stop

After Task 10, **stop and report**. Do **not** commit.

Final report structure:
- Status (DONE / DONE_WITH_CONCERNS / BLOCKED)
- Files changed, grouped by problem
- Test result counts
- Manual verification state (done in browser, or "pending")
- Staging state for both repos
- Concerns / out-of-scope findings

The user will run `git commit` themselves.
