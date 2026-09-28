# Fare Model

| | |
|---|---|
| **Document** | Fare Model |
| **Project** | Dhaka Tesla Pool — MVP |
| **Related** | [Assumptions](assumptions.md) · [ERD](erd.md) · [API](api.md) |

---

## Contents

1. [Goals](#1-goals)
2. [Formula](#2-formula)
3. [Parameters](#3-parameters)
4. [Worked Examples](#4-worked-examples)
5. [When the Fare Is Calculated](#5-when-the-fare-is-calculated)
6. [Money Representation](#6-money-representation)
7. [Stored Fare Breakdown](#7-stored-fare-breakdown)
8. [Test Cases](#8-test-cases)
9. [Out of Scope & Future Extensions](#9-out-of-scope--future-extensions)

---

## 1. Goals

The brief asks for a fare model that is simple, testable, and can be checked **by hand** using Nusrat's and Rafiq's trip. The model is designed around three goals:

| Goal | How the model meets it |
|---|---|
| **Hand-checkable** | Whole-kilometre distances and round parameters produce whole-taka fares. |
| **Fair to each passenger** | Each passenger pays for their own direct distance, never another passenger's detour. |
| **Predictable** | A passenger never pays more than the estimate shown when they requested the ride. |

---

## 2. Formula

The model follows the structure suggested in the brief:

```
passengerFare = baseFare + distanceCharge − poolDiscount
```

Expanded, with seat count:

```
distanceCharge = distanceKm × perKmRate
subtotal       = (baseFare + distanceCharge) × seats
poolDiscount   = subtotal × poolDiscountRate      if the pool has 2+ passengers at start
               = 0                                 otherwise
passengerFare  = subtotal − poolDiscount
```

| Term | Definition |
|---|---|
| `distanceKm` | Direct distance from pickup zone to the passenger's destination zone, from the [distance table](assumptions.md#32-distance-table-km). |
| `seats` | Seats booked by this passenger (1–3). |
| **Pool has 2+ passengers** | At least two distinct ride requests are active members of the pool when the driver starts the trip. Seats booked by the same passenger count once. |

---

## 3. Parameters

| Parameter | Value | Stored value | Unit |
|---|---:|---:|---|
| `baseFare` | ৳30 | `3000` | paisa |
| `perKmRate` | ৳15 per km | `1500` | paisa per km |
| `poolDiscountRate` | 20% | `2000` | basis points (1 bp = 0.01%) |

Parameters are defined in one place in the backend and **copied onto each ride when its fare is locked**, so changing a rate later never alters the history of completed rides.

---

## 4. Worked Examples

All examples use pickup zone **Banani**.

### 4.1 Nusrat and Rafiq share Bullet

| Step | Nusrat (→ Mohakhali) | Rafiq (→ Gulshan 1) |
|---|---:|---:|
| Direct distance | 3 km | 4 km |
| Base fare | ৳30 | ৳30 |
| Distance charge | 3 × ৳15 = ৳45 | 4 × ৳15 = ৳60 |
| Subtotal (1 seat) | ৳75 | ৳90 |
| Pool discount (20%) | − ৳15 | − ৳18 |
| **Final fare** | **৳60** | **৳72** |

Rafiq rides 6 km because Nusrat is dropped first, but he is charged for his direct 4 km. The detour is compensated by the pool discount, not added to his fare.

**Jashim's total for the trip:** ৳60 + ৳72 = **৳132**.

### 4.2 Solo rides (no pooling)

| Passenger | Subtotal | Discount | **Final fare** |
|---|---:|---:|---:|
| Nusrat alone | ৳75 | ৳0 | **৳75** |
| Rafiq alone | ৳90 | ৳0 | **৳90** |

Pooling saves Nusrat ৳15 and Rafiq ৳18.

### 4.3 Shirin takes the last seat

Shirin (Banani → Mohakhali, 3 km) joins Nusrat and Rafiq, filling all three of Bullet's seats.

| Passenger | Subtotal | Discount | **Final fare** |
|---|---:|---:|---:|
| Nusrat | ৳75 | − ৳15 | **৳60** |
| Shirin | ৳75 | − ৳15 | **৳60** |
| Rafiq | ৳90 | − ৳18 | **৳72** |

The discount rate is flat: a third passenger does not increase anyone's discount. **Jashim's total:** ৳192.

### 4.4 One passenger, two seats

Rafiq books 2 seats (travelling with a friend) to Gulshan 1.

| Case | Subtotal | Discount | **Final fare** |
|---|---:|---:|---:|
| Pooled with Nusrat | (৳30 + ৳60) × 2 = ৳180 | − ৳36 | **৳144** |
| Alone | ৳180 | ৳0 | **৳180** |

Rafiq alone with 2 seats is still **one passenger**, so no pool discount applies.

### 4.5 Pool partner cancels before start

Nusrat and Rafiq are matched. Rafiq cancels while the pool is still `MATCHED`. When Jashim starts the trip, Nusrat is the only passenger, so she pays the **solo fare of ৳75**, exactly the estimate she was shown.

---

## 5. When the Fare Is Calculated

| Moment | What happens | Shown to passenger |
|---|---|---|
| **Request** | Solo fare calculated as the **estimate**. | "Estimated fare: ৳75. May drop to ৳60 if shared." |
| **Matched / pool changes** | Nothing is stored; the screen shows a projected fare based on current members. | "Current fare if trip starts now: ৳60" |
| **Trip starts** (`STARTED`) | Final fare calculated from the members present, then **locked**. | "Fare: ৳60" |
| **Trip completes** | Locked fare is recorded as paid (cash). | "Paid: ৳60 (cash)" |

**Why lock at start:** pool membership can change until the passengers are in the car. Locking at start means the discount reflects who actually shared the ride, and cancellations before start need no refunds or recalculation.

**Guarantee:** `finalFare ≤ estimatedFare` always holds, because the estimate is the undiscounted solo price.

---

## 6. Money Representation

All amounts are stored and calculated as **integers in paisa** (৳1 = 100 paisa).

| Option | Verdict | Reason |
|---|---|---|
| **Integer paisa** | **Chosen** | Exact arithmetic, fast, supported identically by PostgreSQL, Prisma and JavaScript. |
| `DECIMAL(10,2)` | Rejected | Exact in the database, but Prisma returns it as a `Decimal` object, so every calculation needs a library and conversions. |
| Floating point (`FLOAT`, JS `number` in taka) | Rejected | Cannot represent values like 0.1 exactly (`0.1 + 0.2 = 0.30000000000000004`), so pooled splits can drift by a paisa. |

**Implementation rules**

| Rule | Detail |
|---|---|
| Column type | PostgreSQL `INTEGER`; the maximum (≈ ৳21 million) far exceeds any single fare. |
| Percentages | Stored as integer basis points; `discount = subtotal × 2000 / 10000`. |
| Rounding | Round half up to the nearest paisa. With the current parameters every result is already a whole number of paisa, so rounding never triggers, but the rule is defined in case parameters change. |
| Display | Converted to taka only in the UI: `6000` → `৳60.00`. |
| Negative values | Not allowed; enforced with a `CHECK (amount >= 0)` constraint. |

---

## 7. Stored Fare Breakdown

Each pool member stores a full breakdown, not just the final number, so any fare can be explained later.

| Field | Example (Nusrat, pooled) |
|---|---:|
| `distanceKm` | 3 |
| `seats` | 1 |
| `baseFarePaisa` | 3000 |
| `perKmRatePaisa` | 1500 |
| `distanceChargePaisa` | 4500 |
| `subtotalPaisa` | 7500 |
| `poolDiscountBps` | 2000 |
| `poolDiscountPaisa` | 1500 |
| `estimatedFarePaisa` | 7500 |
| `finalFarePaisa` | 6000 |
| `fareLockedAt` | 2026-09-28 08:52:10 +06:00 |

`finalFarePaisa` and `fareLockedAt` are empty until the trip starts. `estimatedFarePaisa` is stored on the ride request, since it exists before the passenger joins a pool. The exact table layout is defined in the [ERD](erd.md).

---

## 8. Test Cases

These cases form the unit test suite for the fare calculation. Amounts are in paisa.

| # | Case | km | Seats | Pooled | Expected |
|---|---|---:|---:|:---:|---:|
| F1 | Nusrat pooled | 3 | 1 | Yes | `6000` |
| F2 | Rafiq pooled | 4 | 1 | Yes | `7200` |
| F3 | Nusrat solo | 3 | 1 | No | `7500` |
| F4 | Rafiq solo | 4 | 1 | No | `9000` |
| F5 | Rafiq, 2 seats, pooled | 4 | 2 | Yes | `14400` |
| F6 | Rafiq, 2 seats, solo | 4 | 2 | No | `18000` |
| F7 | Longest trip (Uttara → Dhanmondi), 3 seats, solo | 19 | 3 | No | `94500` |
| F8 | Final fare never exceeds estimate | any | any | any | `final ≤ estimate` |
| F9 | Invalid input (0 seats, 4 seats, 0 km, negative km) | — | — | — | rejected |

---

## 9. Out of Scope & Future Extensions

The brief allows extra rules as long as the core calculation stays testable. None are included in the MVP; each could be added as an extra term without changing the rest of the formula.

| Extension | Possible approach |
|---|---|
| Peak-hour surcharge | Multiplier on `subtotal` during rush hours (e.g. 8–10 AM). |
| Weather / rain surcharge | Flat amount added when enabled by an operator. |
| Vehicle type | Different `baseFare` / `perKmRate` per vehicle class. |
| Platform commission | Percentage of each fare retained by the platform; drivers currently receive 100%. |
| TeslaPay wallet | Simulated balance debited on `COMPLETED` instead of cash. |
| Cancellation fee | Charged when a passenger cancels after `DRIVER_ARRIVED`. |
