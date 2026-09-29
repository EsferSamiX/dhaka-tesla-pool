# API Reference

| | |
|---|---|
| **Document** | API Reference |
| **Project** | Dhaka Tesla Pool — MVP |
| **Related** | [Assumptions](assumptions.md) · [Fare Model](fare-model.md) · [Architecture](architecture.md) · [ERD](erd.md) |

---

## Contents

1. [Conventions](#1-conventions)
2. [Endpoint Summary](#2-endpoint-summary)
3. [Auth](#3-auth)
4. [Zones & Fares](#4-zones--fares)
5. [Passenger Rides](#5-passenger-rides)
6. [Driver](#6-driver)
7. [Health](#7-health)
8. [Error Reference](#8-error-reference)
9. [End-to-End Example](#9-end-to-end-example)

---

## 1. Conventions

| Topic | Rule |
|---|---|
| **Style** | REST over HTTPS, JSON request and response bodies. Reasoning in [architecture.md](architecture.md#43-why-rest). |
| **Base path** | All endpoints are under `/api`. The browser calls the frontend's domain; Next.js forwards `/api/*` to the backend. |
| **Interactive docs** | Swagger UI at `/api/docs`, generated from the code. |
| **Authentication** | JWT in an httpOnly cookie named `token`, set by sign-in. Sent automatically by the browser. |
| **Access** | `Public` · `User` (any signed-in user) · `Passenger` only · `Driver` only |
| **Ownership** | Passengers can only read or change their own rides; drivers only their own pools. Anything else returns `403`. |
| **IDs** | UUIDs, except zones, which are referenced by their code (`BAN`, `MOH`, …). |
| **Money** | Integer **paisa** in every field ending in `Paisa`. `6000` = ৳60.00. |
| **Time** | ISO 8601 in UTC, e.g. `2026-09-28T02:41:00Z`. |
| **Validation** | Unknown fields are rejected. Invalid input returns `400` with a list of problems. |
| **Pagination** | List endpoints accept `?page=1&limit=20` (max 50) and return `{ items, page, limit, total }`. |
| **Actions** | State changes are `POST` to an action path (e.g. `/rides/:id/cancel`), which keeps each transition explicit and auditable. |

---

## 2. Endpoint Summary

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Create a passenger or driver account |
| `POST` | `/api/auth/signin` | Public | Sign in, receive the auth cookie |
| `POST` | `/api/auth/signout` | User | Clear the auth cookie |
| `GET` | `/api/auth/me` | User | Current user (and vehicle, for drivers) |
| `GET` | `/api/zones` | Public | List all zones |
| `POST` | `/api/fares/estimate` | Public | Fare for a trip alone, shared by 2, and by 3 or more |
| `POST` | `/api/rides` | Passenger | Request a ride |
| `GET` | `/api/rides/active` | Passenger | Current ride, if any |
| `GET` | `/api/rides` | Passenger | Ride history |
| `GET` | `/api/rides/:id` | Passenger | One ride, with pool and timeline |
| `POST` | `/api/rides/:id/cancel` | Passenger | Cancel a ride |
| `PATCH` | `/api/driver/status` | Driver | Go online or offline |
| `GET` | `/api/driver/requests` | Driver | Waiting requests this driver can accept |
| `POST` | `/api/driver/requests/:id/accept` | Driver | Accept a request (new pool or add to open pool) |
| `GET` | `/api/driver/pool` | Driver | Current pool, with passengers and seats |
| `POST` | `/api/driver/pool/arrive` | Driver | Mark arrived at pickup |
| `POST` | `/api/driver/pool/start` | Driver | Start the trip, lock fares |
| `POST` | `/api/driver/pool/complete` | Driver | Complete the trip |
| `POST` | `/api/driver/pool/cancel` | Driver | Cancel the pool before start |
| `GET` | `/api/driver/pools` | Driver | Trip history |
| `GET` | `/api/health` | Public | Service and database health |

---

## 3. Auth

### `POST /api/auth/signup` — *Public*

Creates an account. Drivers register their vehicle in the same request.

**Request — passenger**
```json
{
  "name": "Nusrat",
  "email": "nusrat@example.com",
  "password": "at-least-8-chars",
  "role": "PASSENGER"
}
```

**Request — driver**
```json
{
  "name": "Jashim",
  "email": "jashim@example.com",
  "password": "at-least-8-chars",
  "role": "DRIVER",
  "vehicle": { "name": "Bullet", "plateNumber": "DM-TA-11-2025", "capacity": 3 }
}
```

| Field | Rule |
|---|---|
| `name` | 1–100 characters |
| `email` | Valid email; stored lowercase; must be unique |
| `password` | 8–72 characters (bcrypt's limit) |
| `role` | `PASSENGER` or `DRIVER` |
| `vehicle` | Required for `DRIVER`, forbidden for `PASSENGER`; `capacity` 1–6 |

**Response `201`** — the created user (same shape as `GET /api/auth/me`). The user is signed in and the cookie is set.

**Errors:** `400` validation · `409` email already registered · `429` too many attempts

### `POST /api/auth/signin` — *Public*

**Request**
```json
{ "email": "nusrat@example.com", "password": "at-least-8-chars" }
```

**Response `200`** — the user, plus `Set-Cookie: token=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`.

**Errors:** `401` wrong email or password (the message never says which) · `429` too many attempts

### `POST /api/auth/signout` — *User*

Clears the cookie. **Response `204`.**

### `GET /api/auth/me` — *User*

**Response `200`**
```json
{
  "id": "5b0e…",
  "name": "Jashim",
  "email": "jashim@example.com",
  "role": "DRIVER",
  "isOnline": true,
  "vehicle": { "id": "9c1a…", "name": "Bullet", "plateNumber": "DM-TA-11-2025", "capacity": 3 }
}
```
`isOnline` and `vehicle` are `null` for passengers.

---

## 4. Zones & Fares

### `GET /api/zones` — *Public*

**Response `200`**
```json
[
  { "code": "BAN", "name": "Banani", "lat": 23.7937, "lng": 90.4066 },
  { "code": "MOH", "name": "Mohakhali", "lat": 23.7778, "lng": 90.4057 }
]
```

### `POST /api/fares/estimate` — *Public*

Shows the price before requesting. The solo fare is the maximum the passenger can be charged.

**Request**
```json
{ "pickupZone": "BAN", "destinationZone": "MOH", "seats": 1 }
```

**Response `200`**
```json
{
  "distanceKm": 3,
  "soloFarePaisa": 7500,
  "pooledFarePaisa": 6000,
  "fullPoolFarePaisa": 5250,
  "breakdown": {
    "baseFarePaisa": 3000,
    "distanceChargePaisa": 4500,
    "subtotalPaisa": 7500,
    "poolDiscountBps": 2000,
    "fullPoolDiscountBps": 3000
  }
}
```

**Errors:** `400` unknown zone, same pickup and destination, or seats outside 1–3

---

## 5. Passenger Rides

### Ride object

Returned by every ride endpoint. A passenger sees their own fare only; co-riders appear by first name.

```json
{
  "id": "r-1…",
  "status": "MATCHED",
  "pickupZone": { "code": "BAN", "name": "Banani" },
  "destinationZone": { "code": "MOH", "name": "Mohakhali" },
  "pickupNote": "Road 11, near the mosque",
  "seats": 1,
  "distanceKm": 3,
  "fare": {
    "estimatedPaisa": 7500,
    "currentPaisa": 6000,
    "finalPaisa": null,
    "isLocked": false,
    "paidAt": null
  },
  "pool": {
    "id": "p-7…",
    "status": "MATCHED",
    "driver": { "name": "Jashim" },
    "vehicle": { "name": "Bullet", "plateNumber": "DM-TA-11-2025" },
    "dropOffOrder": 1,
    "coRiders": [ { "name": "Rafiq", "seats": 1 } ],
    "seatsLeft": 1
  },
  "createdAt": "2026-09-28T02:41:00Z"
}
```

| Field | Meaning |
|---|---|
| `fare.currentPaisa` | What the passenger would pay if the trip started now; changes as the pool changes. |
| `fare.finalPaisa` | Set when the trip starts; never changes afterwards. |
| `pool` | `null` while `REQUESTED` or after cancellation. |

### `POST /api/rides` — *Passenger*

Requests a ride. If a compatible open pool exists, the passenger joins it immediately ([matching rules](assumptions.md#4-matching-rules)).

**Request**
```json
{ "pickupZone": "BAN", "destinationZone": "MOH", "seats": 1, "pickupNote": "Road 11, near the mosque" }
```

**Response `201`** — the ride object, with `status` either `REQUESTED` (waiting for a driver) or `MATCHED` (joined a pool).

**Errors:** `400` validation · `409` passenger already has an active ride

### `GET /api/rides/active` — *Passenger*

**Response `200`** — the ride object, or `null` if none. The frontend polls this every 3–5 seconds while a ride is active.

### `GET /api/rides` — *Passenger*

Ride history, newest first. **Response `200`** — `{ items: [ride], page, limit, total }`.

### `GET /api/rides/:id` — *Passenger*

The ride object plus its timeline.

```json
{
  "...": "ride object fields",
  "timeline": [
    { "from": null, "to": "REQUESTED", "by": "PASSENGER", "reason": null, "at": "2026-09-28T02:41:00Z" },
    { "from": "REQUESTED", "to": "MATCHED", "by": "DRIVER", "reason": "Accepted request", "at": "2026-09-28T02:41:40Z" }
  ]
}
```

**Errors:** `403` not your ride · `404` not found

### `POST /api/rides/:id/cancel` — *Passenger*

**Request**
```json
{ "reason": "Plans changed" }
```
`reason` is optional, up to 200 characters.

**Response `200`** — the ride object with `status: "CANCELLED"`. Seats are released in the same transaction.

**Errors:** `403` not your ride · `404` not found · `409` ride already `STARTED`, `COMPLETED` or `CANCELLED`

---

## 6. Driver

### `PATCH /api/driver/status` — *Driver*

**Request**
```json
{ "isOnline": true }
```

**Response `200`** — `{ "isOnline": true }`

**Errors:** `409` cannot go offline with an active pool

### `GET /api/driver/requests` — *Driver*

Waiting requests (`REQUESTED`), oldest first.

- **No active pool:** all waiting requests.
- **Open pool (`MATCHED`):** only requests that pass the matching rules for that pool.
- **Pool already arrived or started:** an empty list.

**Response `200`**
```json
[
  {
    "id": "r-2…",
    "passenger": { "name": "Rafiq" },
    "pickupZone": { "code": "BAN", "name": "Banani" },
    "destinationZone": { "code": "GL1", "name": "Gulshan 1" },
    "pickupNote": null,
    "seats": 1,
    "distanceKm": 4,
    "estimatedFarePaisa": 9000,
    "waitingSince": "2026-09-28T02:43:00Z"
  }
]
```

**Errors:** `409` driver is offline

### `POST /api/driver/requests/:id/accept` — *Driver*

- **No active pool:** creates a pool with this request.
- **Open pool:** adds the request to it, if it passes the matching rules.

Runs in one transaction with the pool row locked ([concurrency](architecture.md#8-concurrency--data-consistency)).

**Response `200`** — the driver's pool object (see below).

**Errors:** `404` request not found · `409` request no longer waiting, not enough seats, fails the matching rules, driver offline, or pool already arrived/started

### Pool object

Returned by all `/api/driver/pool*` endpoints. The driver sees every member's fare.

```json
{
  "id": "p-7…",
  "status": "MATCHED",
  "pickupZone": { "code": "BAN", "name": "Banani" },
  "capacity": 3,
  "occupiedSeats": 2,
  "members": [
    {
      "rideId": "r-1…",
      "passenger": { "name": "Nusrat" },
      "destinationZone": { "code": "MOH", "name": "Mohakhali" },
      "pickupNote": "Road 11, near the mosque",
      "seats": 1,
      "dropOffOrder": 1,
      "farePaisa": 6000,
      "fareLocked": false
    },
    {
      "rideId": "r-2…",
      "passenger": { "name": "Rafiq" },
      "destinationZone": { "code": "GL1", "name": "Gulshan 1" },
      "pickupNote": null,
      "seats": 1,
      "dropOffOrder": 2,
      "farePaisa": 7200,
      "fareLocked": false
    }
  ],
  "totalFarePaisa": 13200,
  "createdAt": "2026-09-28T02:41:40Z",
  "arrivedAt": null,
  "startedAt": null,
  "completedAt": null
}
```

### `GET /api/driver/pool` — *Driver*

**Response `200`** — the current pool object, or `null`.

### Pool actions — *Driver*

| Endpoint | Transition | Extra effect | `409` when |
|---|---|---|---|
| `POST /api/driver/pool/arrive` | `MATCHED → DRIVER_ARRIVED` | Pool stops accepting members | Pool not `MATCHED` |
| `POST /api/driver/pool/start` | `DRIVER_ARRIVED → STARTED` | **Fares calculated and locked** | Pool not `DRIVER_ARRIVED`, or no members left |
| `POST /api/driver/pool/complete` | `STARTED → COMPLETED` | Fares marked paid (cash); driver free | Pool not `STARTED` |
| `POST /api/driver/pool/cancel` | `MATCHED`/`DRIVER_ARRIVED → CANCELLED` | Members return to `REQUESTED` | Pool already `STARTED` |

`/cancel` takes an optional `{ "reason": "Vehicle breakdown" }`. Each action applies the same transition to every active member and records it in their timeline. **Response `200`** — the updated pool object. **`404`** if the driver has no active pool.

### `GET /api/driver/pools` — *Driver*

Trip history, newest first. **Response `200`** — `{ items: [pool], page, limit, total }`.

---

## 7. Health

### `GET /api/health` — *Public*

**Response `200`**
```json
{ "status": "ok", "database": "ok" }
```

**Response `503`** if the database is unreachable:
```json
{ "statusCode": 503, "error": "Service Unavailable", "message": "Database unreachable", "requestId": "…" }
```
Used by the Docker Compose health check.

---

## 8. Error Reference

Every error uses one shape:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "No seats left in this pool",
  "requestId": "b3f1c2e0-…"
}
```

Validation errors list every problem:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["seats must not be greater than 3", "destinationZone must differ from pickupZone"],
  "requestId": "…"
}
```

| Status | Meaning in this API |
|---|---|
| `400` | Input failed validation |
| `401` | Not signed in, token expired, or wrong credentials |
| `403` | Wrong role, or not the owner of the ride or pool |
| `404` | Resource not found |
| `409` | Business rule blocked it: invalid transition, no seats, already has an active ride, fails matching |
| `429` | Too many sign-in or sign-up attempts |
| `500` | Unexpected error; details are logged under `requestId`, never returned |
| `503` | Database unavailable (health check) |

---

## 9. End-to-End Example

Nusrat and Rafiq share Bullet on the morning of the story.

| # | Who | Call | Result |
|---|---|---|---|
| 1 | Jashim | `PATCH /api/driver/status` `{ isOnline: true }` | Online |
| 2 | Nusrat | `POST /api/fares/estimate` BAN → MOH | Alone ৳75, with 2 ৳60, with 3+ ৳52.50 |
| 3 | Nusrat | `POST /api/rides` BAN → MOH | `REQUESTED` (no open pool yet) |
| 4 | Jashim | `GET /api/driver/requests` | Sees Nusrat |
| 5 | Jashim | `POST /api/driver/requests/{nusrat}/accept` | Pool created; Nusrat `MATCHED` |
| 6 | Rafiq | `POST /api/rides` BAN → GL1 | Joins the pool automatically; `MATCHED` |
| 7 | Nusrat | `GET /api/rides/active` | Co-rider Rafiq; current fare ৳60 |
| 8 | Jashim | `POST /api/driver/pool/arrive` | Both `DRIVER_ARRIVED` |
| 9 | Jashim | `POST /api/driver/pool/start` | Both `STARTED`; fares locked at ৳60 and ৳72 |
| 10 | Jashim | `POST /api/driver/pool/complete` | Both `COMPLETED`; ৳132 cash |

**Variation — the last seat:** after step 6, Bullet has one seat left. If Shirin and a fourth passenger both send `POST /api/rides` for a compatible trip at the same moment, exactly one joins the pool; the other receives `201` with status `REQUESTED` and waits for another driver.
