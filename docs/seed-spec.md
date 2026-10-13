# Seed and Test-Fixture Specification

**Status: FROZEN by task T01.** Implemented by `manage.py seed_demo` and `manage.py seed_test_fixtures` (task T06). E2E, API and smoke tests may rely on every value here. Sources: PRD §11, plan §8, D-45, D-46, D-47.

## 1. Rules for both commands

* Ids are the fixed UUIDs below (so tests can address records). Timestamps are fixed (UTC), all in the past, never `now()`.
* Passwords: `SEED_DEMO_PASSWORD` for every account (D-46). The command stops with an error if it is unset or shorter than 12 characters, and never prints it.
* Emails are stored lowercase. `Company.name` and `display_name` are exactly as written.
* Each decided request has all of `decided_by`, `decided_at` (and `rejection_reason` if rejected) filled, with `decided_at` after `submitted_at` and `decided_by` a Manager of the same company who is not the requester.
* **Idempotent default (D-45):** running again creates only missing rows by id and changes nothing that exists. `--reset` removes all application data first and requires `--yes-i-am-sure` and `ALLOW_SEED_RESET=true`.
* `seed_test_fixtures` is refused unless `DJANGO_ENV` is `dev` or `test`, and requires `seed_demo` data to exist.

## 2. `seed_demo` — companies and accounts (PRD §11)

| Company | id | Person | Role | Email | User id |
|---|---|---|---|---|---|
| Northstar Labs | `587682aa-b865-4a50-9035-4b5551defd6b` | Alex Morgan | employee | alex@northstar.example | `2bc1188c-bc4c-4dc3-8536-0b3c667a7977` |
| Northstar Labs | | Sam Rivera | employee | sam@northstar.example | `a66ad261-6322-43d0-b2fa-307c87e52f69` |
| Northstar Labs | | Jordan Lee | manager | jordan@northstar.example | `3f78235c-d9b2-4dac-8767-79f4bbe833c2` |
| Northstar Labs | | Taylor Chen | manager | taylor@northstar.example | `26a6e77c-e9dd-4256-a564-237acf4fef97` |
| Harbor Works | `7ed2940e-82f6-4e2f-a1a1-624a982276a3` | Casey Patel | employee | casey@harbor.example | `eb530f0d-6203-4590-9663-61752e919c5b` |
| Harbor Works | | Riley Brooks | manager | riley@harbor.example | `1f8ff934-0277-4387-9b97-e7cf0bcfb6a2` |

## 3. `seed_demo` — requests (8)

All amounts are USD. The amount in the `Amount` column is the exact stored string.

| # | id | Company | Requester | Status | Title | Vendor | Amount | Submitted (UTC) | Decided by, at |
|---|---|---|---|---|---|---|---|---|---|
| N1 | `86935e09-143b-482a-bf3c-f7400bc4b6de` | Northstar | Alex | pending | Standing desk for design team | Ergo Office Supply | 649.00 | 2026-10-01 09:15:00 | – |
| N2 | `c24bfa1c-bfe6-4a3e-aa16-94a938408533` | Northstar | Alex | pending | Annual design tool licenses | Pixelforge Software | 4,200.00 → `4200.00` | 2026-10-02 13:40:00 | – |
| N3 | `3abb0e19-9e9b-4175-927d-b4267f6b614b` | Northstar | Sam | pending | Team offsite catering | Green Fork Catering | 1250.50 | 2026-10-03 08:05:00 | – |
| N4 | `5d3c1a76-ac3f-4038-bade-975bf75a06ce` | Northstar | Jordan | pending | Conference travel for Q4 summit | Skyway Travel | 2380.75 | 2026-10-04 16:20:00 | – |
| N5 | `d21a4ea9-e5d4-4be4-b55e-10e0c70b37ea` | Northstar | Alex | approved | Laptop replacement | Byte Hardware Direct | 1899.99 | 2026-09-28 10:00:00 | Jordan, 2026-09-29 11:30:00 |
| N6 | `35aba7f5-7773-4599-a72d-5403282a3f07` | Northstar | Sam | rejected | Premium coffee machine | Barista Pro Equipment | 3299.00 | 2026-09-26 14:10:00 | Jordan, 2026-09-27 09:45:00 |
| H1 | `0d02dd1a-0b66-4756-a86d-724d1706d19a` | Harbor | Casey | pending | Warehouse safety gloves | SafeGrip Supplies | 312.40 | 2026-10-05 07:30:00 | – |
| H2 | `58cbac00-1ad9-4906-9d31-ce978c20a514` | Harbor | Casey | approved | Pallet jack maintenance contract | Dockside Services | 780.00 | 2026-09-30 12:00:00 | Riley, 2026-10-01 08:20:00 |

Note: the amount in row N2 is stored as the string `4200.00`; the comma form is not stored.

Exact text:

* **N1 description** (multiline, 3 lines): `Two sit-stand desks, 160 cm wide.` / `Needed for the new design hires starting next week.` / `Delivery to the 3rd floor.` (joined with `\n`).
* N2 description: `Renewal of 5 seats for the design team.`
* N3 description: `Lunch for 24 people at the quarterly offsite.`
* N4 description: `Flights and hotel for two people attending the summit.`
* N5 description: `Current laptop is out of warranty and failing.`
* **N6 rejection reason:** `Budget for office equipment is exhausted this quarter.`
* N6 description: `Espresso machine for the shared kitchen.`
* H1 description: `Replacement gloves for the loading dock crew.`
* H2 description: `Yearly service contract for two pallet jacks.`

Requests per the PRD: Northstar has two Pending from Alex (N1, N2), one Pending from Sam (N3), one Pending from Jordan (N4), one Approved from Alex (N5), one Rejected from Sam (N6); Harbor has one Pending (H1) and one Approved (H2) from Casey. Jordan is the only decider in Northstar and Riley in Harbor, as the PRD allows. Taylor has no requests and is available as the second manager for conflict and own-request tests.

## 4. `seed_test_fixtures` (dev and test only)

Adds a third company and extra users and requests. These never exist on staging.

| Company | id |
|---|---|
| Fixture Co | `93d3e72c-a081-4027-a2bb-090a95679d04` |

| Person | Role | Email | User id | Purpose |
|---|---|---|---|---|
| Mia Fischer | employee | mia@fixture.example | `ee3a02f0-4859-4943-ae9c-c5c612d32819` | **Empty list**: has no requests |
| Eli Novak | employee | eli@fixture.example | `d8cc72ba-e377-46d8-ba1c-183d8cf1529c` | **No filter match**: has 3 requests, all pending, so the Approved and Rejected filters are empty |
| Ola Berg | manager | ola@fixture.example | `c70dcefb-02f8-4241-ada7-e1e6d4cd3c45` | **Pagination**: sees all Fixture Co requests (more than 20) |
| Noa Weiss | employee | noa@fixture.example | `c91fb8fb-0574-4902-a5f0-6d94f73fa6d9` | **Pagination as employee**: 25 own requests |

Fixture Co requests (generated, in this order, all `USD`, description `Fixture request {n}.`, title `Fixture request {n}`, vendor `Fixture Vendor {n mod 7}`):

* Eli: 3 pending, `n = 1..3`.
* Noa: 25 requests, `n = 4..28`, statuses cycling pending, approved, rejected by `n mod 3` (0 pending, 1 approved, 2 rejected). Approved and rejected ones are decided by Ola, `decided_at` = `submitted_at` + 1 hour, rejection reason `Fixture rejection {n}.`.
* Ola: 17 pending requests, `n = 29..45`, so the manager sees 45 requests in total (3 + 25 + 17) = 3 pages of 20.
* Amounts: `"{n}.00"`, except when `n mod 5 = 0`, where the amount is `"{n}.50"`.
* **Tied timestamps:** request ids are `uuid5(namespace=Fixture Co id, name="request-{n}")`. Submitted time for `n` is `2026-09-01 08:00:00` + `(n // 4)` minutes, so groups of 4 consecutive requests share one timestamp. This tests the `submitted_at DESC, id DESC` tie-break (D-13).

Counts a test may rely on: Eli sees 3; Noa sees 25 (2 pages); Ola sees 45 (3 pages: 20, 20, 5); Mia sees 0.

## 5. What tests must not assume

* Tests that need a clean database call `seed_demo --reset` in a dev or test environment (never on staging).
* Staging shows only the `seed_demo` data plus whatever users create afterwards. The smoke test must create its own requests.
