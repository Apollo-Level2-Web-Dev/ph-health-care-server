# 🚀 Complete Migration Guide: SSLCommerz to Stripe + Prisma 7 Upgrade

## 📋 Table of Contents

1. [Overview](#overview)
2. [Payment System Migration (SSLCommerz → Stripe)](#payment-system-migration)
3. [Prisma 7 Upgrade](#prisma-7-upgrade)
4. [Setup Instructions for New Developers](#setup-instructions)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This document details ALL changes made to migrate from SSLCommerz payment gateway to Stripe and upgrade from Prisma 6 to Prisma 7.

### What Changed?

- ✅ **Payment Gateway**: SSLCommerz → Stripe Checkout
- ✅ **Prisma Version**: 6.19.0 → 7.0.1
- ✅ **Database Connection**: Direct connection → Adapter-based with connection pooling
- ✅ **Schema Configuration**: Inline URL → External configuration via adapter
- ✅ **Payment Security**: Hardcoded secrets → Environment-based configuration
- ✅ **Best Practices**: Added idempotency, transactions, multiple event handling

---

## Payment System Migration (SSLCommerz → Stripe)

### 🎯 Why This Change?

**SSLCommerz Issues:**

- Limited to Bangladesh only
- Complex integration with multiple callbacks
- Poor documentation
- Inconsistent error handling

**Stripe Benefits:**

- Global payment support
- Excellent documentation and SDK
- Built-in security features
- Better testing tools (Stripe CLI)
- Webhook-based confirmation (more reliable)

---

### 📁 Files Created

#### 1. `src/helpers/stripe.ts` (NEW)

**Purpose**: Initialize Stripe client for reuse across the application

```typescript
import Stripe from "stripe";
import config from "../config";

export const stripe = new Stripe(config.stripeSecretKey as string);
```

**Why**: Centralizes Stripe initialization, prevents multiple client instances

---

### 📝 Files Modified

#### 1. `src/config/index.ts`

**Changes Made:**

```typescript
// ❌ REMOVED (7 SSL properties)
ssl: {
  store_id: process.env.SSL_STORE_ID,
  store_passwd: process.env.SSL_STORE_PASSWD,
  success_url: process.env.SSL_SUCCESS_URL,
  cancel_url: process.env.SSL_CANCEL_URL,
  fail_url: process.env.SSL_FAIL_URL,
  ssl_payment_api: process.env.SSL_PAYMENT_API,
  ssl_validation_api: process.env.SSL_VALIDATION_API,
}

// ✅ ADDED (2 Stripe properties)
stripeSecretKey: process.env.STRIPE_SECRET_KEY,
stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
```

**Why**:

- SSL config no longer needed
- Stripe requires API key and webhook secret for security
- Webhook secret validates that events come from Stripe (prevents spoofing)

---

#### 2. `prisma/schema/appointment.prisma`

**Changes Made:**

```prisma
model Payment {
  id                 String        @id @default(uuid())
  appointmentId      String        @unique
  amount             Float
  transactionId      String        @unique
  status             PaymentStatus @default(UNPAID)
  paymentGatewayData Json?
  stripeEventId      String?       @unique  // ✅ NEW FIELD
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@map("payments")
}
```

**Why `stripeEventId` field?**

- **Idempotency**: Prevents duplicate webhook processing
- **Problem**: Stripe may send same webhook multiple times (network issues, retries)
- **Solution**: Store event ID, skip if already processed
- **Example**: Payment succeeds, webhook fires twice → without this field, payment marked PAID twice (potential double-charging)

**Migration Required**: Yes (database schema change)

---

#### 3. `src/app/modules/Payment/payment.service.ts`

**Complete Rewrite**: Changed from SSLCommerz validation to Stripe webhook handling

**Old Approach (SSLCommerz):**

```typescript
// Step 1: User clicks pay
// Step 2: Redirect to SSL
// Step 3: SSL redirects back with tran_id
// Step 4: Call SSL API to validate tran_id
// Step 5: Update payment status
```

**New Approach (Stripe):**

```typescript
// Step 1: User clicks pay
// Step 2: Redirect to Stripe Checkout
// Step 3: Stripe sends webhook when payment completes
// Step 4: Verify webhook signature
// Step 5: Update payment status
```

**Key Implementation Details:**

##### A. Event Idempotency Check

```typescript
const existingPayment = await prisma.payment.findFirst({
  where: { stripeEventId: event.id },
});

if (existingPayment) {
  console.log(`⚠️ Event ${event.id} already processed. Skipping.`);
  return { message: "Event already processed" };
}
```

**Why**: Prevents duplicate processing if Stripe retries webhook

##### B. Metadata Validation

```typescript
const appointmentId = session.metadata?.appointmentId;
const paymentId = session.metadata?.paymentId;

if (!appointmentId || !paymentId) {
  console.error("⚠️ Missing metadata in webhook event");
  return { message: "Missing metadata" };
}
```

**Why**: Links Stripe payment to our appointment and payment records

##### C. Appointment Existence Check

```typescript
const appointment = await prisma.appointment.findUnique({
  where: { id: appointmentId },
});

if (!appointment) {
  console.error(`⚠️ Appointment not found`);
  // TODO: Implement refund logic here
  return { message: "Appointment not found" };
}
```

**Why**:

- User might delete appointment while payment processing
- Prevents charging for non-existent appointments
- Leaves TODO for automatic refund implementation

##### D. Transaction-Based Updates

```typescript
await prisma.$transaction(async (tx) => {
  await tx.appointment.update({
    where: { id: appointmentId },
    data: { paymentStatus: PaymentStatus.PAID },
  });

  await tx.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.PAID,
      paymentGatewayData: session,
      stripeEventId: event.id,
    },
  });
});
```

**Why**:

- **Atomicity**: Either both updates succeed or both fail
- **Problem without transaction**: Appointment updates, then server crashes → Payment stays UNPAID but appointment is PAID (data inconsistency)
- **Solution**: Prisma transaction ensures both or neither

##### E. Multiple Event Types

```typescript
switch (event.type) {
  case "checkout.session.completed":
  // Payment succeeded

  case "checkout.session.expired":
  // Session expired without payment

  case "payment_intent.payment_failed":
  // Payment failed (card declined, etc.)

  default:
  // Log unhandled events
}
```

**Why**:

- Handles success, expiration, and failure scenarios
- Better user experience (can notify user of failures)
- Complete event coverage for production reliability

---

#### 4. `src/app/modules/Payment/payment.controller.ts`

**Complete Rewrite**: Changed from SSLCommerz validation endpoint to Stripe webhook handler

**Key Changes:**

##### A. Raw Body Requirement

```typescript
// In app.ts, webhook route defined BEFORE express.json()
app.post(
  "/webhook",
  express.raw({ type: "application/json" }), // ⚠️ MUST be raw
  PaymentController.handleStripeWebhookEvent
);
```

**Why**:

- Stripe signature verification requires raw body
- If body is parsed to JSON first, signature verification fails
- **Critical**: This route MUST come before `app.use(express.json())`

##### B. Webhook Signature Verification

```typescript
const sig = req.headers["stripe-signature"] as string;
const webhookSecret = config.stripeWebhookSecret as string;

if (!webhookSecret) {
  console.error("⚠️ Stripe webhook secret not configured");
  return res.status(500).send("Webhook secret not configured");
}

let event;
try {
  event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
} catch (err: any) {
  console.error("⚠️ Webhook signature verification failed:", err.message);
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

**Why**:

- **Security**: Verifies webhook actually came from Stripe
- **Without verification**: Anyone could send fake webhooks to mark payments as paid
- **How it works**: Stripe signs each webhook with secret, we verify signature matches

##### C. Always Return 200

```typescript
try {
    const result = await PaymentService.handleStripeWebhookEvent(event);
    sendResponse(res, { statusCode: 200, ... });
} catch (error: any) {
    console.error("❌ Error processing webhook:", error);
    // ⚠️ Still return 200!
    sendResponse(res, { statusCode: 200, ... });
}
```

**Why**:

- Stripe retries webhooks that return error codes
- If we return 500, Stripe keeps retrying
- We acknowledge receipt (200) even if processing fails
- Log error for manual investigation
- **Best Practice**: Return 200, handle errors internally

---

#### 5. `src/app/modules/Appointment/appointment.service.ts`

**Major Changes to `createAppointment` Function:**

##### A. Complete Flow

```typescript
const createAppointment = async (user: IAuthUser, payload: any) => {
  // 1. Verify patient exists
  const patientData = await prisma.patient.findUniqueOrThrow({
    where: { email: user?.email },
  });

  // 2. Verify doctor exists and not deleted
  const doctorData = await prisma.doctor.findUniqueOrThrow({
    where: { id: payload.doctorId, isDeleted: false },
  });

  // 3. Verify schedule slot is available
  await prisma.doctorSchedules.findFirstOrThrow({
    where: {
      doctorId: doctorData.id,
      scheduleId: payload.scheduleId,
      isBooked: false, // ⚠️ Must be available
    },
  });

  const videoCallingId = uuidv4();

  // 4. Create appointment, mark slot booked, create payment, generate Stripe session
  const result = await prisma.$transaction(async (tnx) => {
    // ... (detailed below)
  });

  return result;
};
```

##### B. Transaction Steps (5 Database Operations)

**Step 1: Create Appointment**

```typescript
const appointmentData = await tnx.appointment.create({
  data: {
    patientId: patientData.id,
    doctorId: doctorData.id,
    scheduleId: payload.scheduleId,
    videoCallingId,
  },
});
```

- Creates appointment record
- Status: SCHEDULED (default)
- Payment status: UNPAID (default)

**Step 2: Mark Doctor Schedule as Booked**

```typescript
await tnx.doctorSchedules.update({
  where: {
    doctorId_scheduleId: {
      doctorId: doctorData.id,
      scheduleId: payload.scheduleId,
    },
  },
  data: { isBooked: true },
});
```

- Prevents double-booking
- Uses composite unique key (doctorId + scheduleId)

**Step 3: Generate Transaction ID**

```typescript
const transactionId = uuidv4();
```

- Unique identifier for payment tracking
- Format: UUID v4 (e.g., "123e4567-e89b-12d3-a456-426614174000")

**Step 4: Create Payment Record**

```typescript
const paymentData = await tnx.payment.create({
  data: {
    appointmentId: appointmentData.id,
    amount: doctorData.appointmentFee,
    transactionId,
  },
});
```

- Links payment to appointment
- Stores fee amount
- Status: UNPAID (default)

**Step 5: Create Stripe Checkout Session**

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  mode: "payment",
  customer_email: user.email,
  line_items: [
    {
      price_data: {
        currency: "bdt",
        product_data: {
          name: `Appointment with ${doctorData.name}`,
        },
        unit_amount: doctorData.appointmentFee * 100, // Convert to cents
      },
      quantity: 1,
    },
  ],
  metadata: {
    appointmentId: appointmentData.id,
    paymentId: paymentData.id,
  },
  success_url: `${
    process.env.FRONTEND_URL || "https://www.programming-hero.com/"
  }`,
  cancel_url: `${
    process.env.FRONTEND_URL || "https://next.programming-hero.com/"
  }`,
});

return { paymentUrl: session.url };
```

**Key Details:**

- **currency: "bdt"**: Bangladeshi Taka
- **unit_amount**: Amount in CENTS (multiply by 100)
  - Example: 500 BDT = 50000 cents
- **metadata**: Attached to session, returned in webhook
  - Critical for linking Stripe payment to our records
- **success_url**: Where to redirect after payment
- **cancel_url**: Where to redirect if user cancels
- **Dynamic URLs**: Uses FRONTEND_URL env var with fallback

##### C. Unpaid Appointment Cleanup (Cron Job)

```typescript
const cancelUnpaidAppointments = async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const unpaidAppointments = await prisma.appointment.findMany({
    where: {
      createdAt: { lte: thirtyMinutesAgo },
      paymentStatus: PaymentStatus.UNPAID,
    },
  });

  const appointmentIdsToCancel = unpaidAppointments.map(
    (appointment) => appointment.id
  );

  await prisma.$transaction(async (tnx) => {
    // Cancel appointments
    await tnx.appointment.updateMany({
      where: { id: { in: appointmentIdsToCancel } },
      data: { status: AppointmentStatus.CANCELLED },
    });

    // Free up doctor schedules
    for (const unPaidAppointment of unpaidAppointments) {
      await tnx.doctorSchedules.update({
        where: {
          doctorId_scheduleId: {
            doctorId: unPaidAppointment.doctorId,
            scheduleId: unPaidAppointment.scheduleId,
          },
        },
        data: { isBooked: false },
      });
    }

    // Delete unpaid payment records
    await tnx.payment.deleteMany({
      where: { appointmentId: { in: appointmentIdsToCancel } },
    });
  });
};
```

**Why This Function?**

- **Problem**: User creates appointment, gets payment link, never pays
- **Result**: Doctor schedule slot stays blocked forever
- **Solution**: Auto-cancel appointments older than 30 minutes with no payment
- **Benefits**:
  - Frees up slots for other patients
  - Cleans up database
  - Prevents abandoned bookings

---

#### 6. `src/app.ts`

**Critical Changes:**

##### A. Webhook Route Placement

```typescript
const app: Application = express();
app.use(cookieParser());

// ⚠️ WEBHOOK MUST BE FIRST (before express.json())
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.handleStripeWebhookEvent
);

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

// Parser comes AFTER webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
```

**Why This Order?**

1. Stripe signature verification needs raw body
2. `express.json()` parses body to JSON (destroys raw format)
3. If webhook route comes after `express.json()`, signature verification fails
4. **Critical**: Webhook route MUST be before any body-parsing middleware

##### B. Cron Job Setup

```typescript
cron.schedule("*/5 * * * *", () => {
  try {
    console.log(
      "🔄 Running unpaid appointment cleanup at",
      new Date().toISOString()
    );
    AppointmentService.cancelUnpaidAppointments();
  } catch (err) {
    console.error("❌ Cron job error:", err);
  }
});
```

**Cron Expression Breakdown:**

- `*/5`: Every 5 minutes
- `*`: Every hour
- `*`: Every day
- `*`: Every month
- `*`: Every day of week

**Why Every 5 Minutes?**

- Appointments are cancelled after 30 minutes
- Checking every 5 minutes provides good cleanup frequency
- Not too frequent (saves resources)
- Not too infrequent (timely cleanup)

**Why Not Every Minute? (Like Old_Backend)**

- Unnecessary server load
- Most users pay within first few minutes or never
- 5-minute interval is production-ready

---

#### 7. `.env.example`

**Changes Made:**

```env
# ❌ REMOVED (SSL Variables)
SSL_STORE_ID=your_store_id
SSL_STORE_PASSWD=your_store_password
SSL_PAYMENT_API=https://sandbox.sslcommerz.com/gwprocess/v4/api.php
SSL_VALIDATION_API=https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php
SSL_SUCCESS_URL=http://localhost:5000/api/v1/payment/success
SSL_CANCEL_URL=http://localhost:5000/api/v1/payment/cancel
SSL_FAIL_URL=http://localhost:5000/api/v1/payment/fail

# ✅ ADDED (Stripe Variables)
### Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

### Frontend URL (for payment redirects)
FRONTEND_URL=http://localhost:3000
```

**Variable Explanations:**

**STRIPE_SECRET_KEY:**

- Format: `sk_test_...` (test) or `sk_live_...` (production)
- Purpose: Authenticate API requests to Stripe
- Where to get: Stripe Dashboard → Developers → API Keys
- **Security**: NEVER commit to Git, keep in .env only

**STRIPE_WEBHOOK_SECRET:**

- Format: `whsec_...`
- Purpose: Verify webhook signatures
- Where to get:
  - Production: Stripe Dashboard → Developers → Webhooks → Add endpoint
  - Development: Stripe CLI (`stripe listen --forward-to localhost:5000/webhook`)
- **Security**: Each endpoint has different secret

**FRONTEND_URL:**

- Your frontend application URL
- Used for payment success/cancel redirects
- Development: `http://localhost:3000`
- Production: Your deployed frontend URL

---

#### 8. `package.json`

**Changes Made:**

```json
{
  "dependencies": {
    "@prisma/adapter-pg": "^7.0.1", // ✅ NEW
    "@prisma/client": "7.0.1", // ⬆️ Upgraded from 6.19.0
    "pg": "^8.16.3", // ✅ NEW
    "prisma": "7.0.1", // ⬆️ Upgraded from 6.19.0 (moved to devDependencies)
    "stripe": "^19.1.0" // Already existed
  },
  "devDependencies": {
    "@types/pg": "^8.15.6", // ✅ NEW
    "prisma": "7.0.1" // ⬆️ Moved here from dependencies
  }
}
```

**Package Purposes:**

**@prisma/adapter-pg:**

- PostgreSQL adapter for Prisma 7
- Enables connection pooling
- Required for new Prisma 7 architecture

**pg:**

- PostgreSQL driver for Node.js
- Used by adapter for actual database connections
- Mature, well-tested library

**@types/pg:**

- TypeScript type definitions for pg
- Development dependency only
- Provides autocomplete and type safety

---

#### 9. `tsconfig.json`

**Changes Made:**

```json
{
  "exclude": [
    "node_modules",
    "Old_Backend" // ✅ Added
  ]
}
```

**Why**:

- Old_Backend folder contains reference code from part-9 branch
- No need to compile it
- Prevents TypeScript errors from old code
- Faster compilation

---

### 🗑️ Files Deleted

#### 1. `src/app/modules/SSL/ssl.service.ts` (76 lines)

**What it contained:**

- `initPayment()`: Initialize SSLCommerz payment
- `validatePayment()`: Validate payment with SSL API
- API endpoint construction
- Request/response handling

**Why deleted**: Entire SSLCommerz integration removed

#### 2. `src/app/modules/SSL/ssl.interface.ts`

**What it contained:**

- TypeScript interfaces for SSL requests
- Response type definitions
- Payment status enums

**Why deleted**: No longer needed with Stripe

#### 3. Entire `src/app/modules/SSL/` directory removed

---

## Prisma 7 Upgrade

### 🎯 Why Upgrade?

**Prisma 7 Changes:**

- **New Configuration System**: `prisma.config.ts` instead of inline URLs
- **Adapter-Based Connections**: Better connection pooling
- **Performance Improvements**: Faster query engine
- **Better Type Safety**: Enhanced TypeScript support
- **Deprecation Warnings**: Old `datasource.url` property deprecated

---

### 📝 Schema Changes

#### `prisma/schema/schema.prisma`

**Before (Prisma 6):**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // ❌ Deprecated in Prisma 7
}
```

**After (Prisma 7):**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // ✅ No URL here - handled by adapter
}
```

**Why**: Prisma 7 moves connection configuration to runtime (adapter) instead of schema file

---

### 📁 Connection Configuration

#### `src/shared/prisma.ts`

**Before (Prisma 6):**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: [...]
});

export default prisma;
```

**After (Prisma 7):**

```typescript
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Pass adapter to Prisma Client
const prisma = new PrismaClient({
    adapter,  // ✅ Connection via adapter
    log: [...]
});

export default prisma;
```

**Benefits:**

1. **Connection Pooling**: Reuses database connections (faster, more efficient)
2. **Better Resource Management**: Automatic connection lifecycle
3. **Scalability**: Handles more concurrent requests
4. **Production-Ready**: Industry-standard pooling

**How Connection Pooling Works:**

```
Without Pooling:
Request 1 → New Connection → Query → Close Connection
Request 2 → New Connection → Query → Close Connection
(Slow: Creating connections is expensive)

With Pooling:
Request 1 → Get Connection from Pool → Query → Return to Pool
Request 2 → Reuse Connection from Pool → Query → Return to Pool
(Fast: Connection already established)
```

---

### 🛠️ Package.json Scripts

**Before:**

```json
{
  "prisma": {
    "schema": "./prisma/schema/" // ❌ Deprecated
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate"
  }
}
```

**After:**

```json
{
  "scripts": {
    "db:generate": "prisma generate --schema=./prisma/schema",
    "db:migrate": "prisma migrate --schema=./prisma/schema",
    "db:push": "prisma db push --schema=./prisma/schema",
    "db:pull": "prisma db pull --schema=./prisma/schema",
    "db:studio": "prisma studio --schema=./prisma/schema",
    "postinstall": "prisma generate --schema=./prisma/schema"
  }
}
```

**Changes:**

- Removed deprecated `package.json#prisma` config
- Added `--schema=./prisma/schema` flag to all commands
- **Why**: Explicitly tell Prisma where schema directory is

---

## Setup Instructions for New Developers

### 🎯 Prerequisites

**Required Software:**

- Node.js 18+ or 20+
- PostgreSQL 14+ (running locally or remotely)
- pnpm (package manager)
- Git

**Optional (Recommended):**

- Stripe CLI (for local webhook testing)
- Postman or Thunder Client (for API testing)
- DBeaver or pgAdmin (for database GUI)

---

### 📥 Step-by-Step Setup

#### Step 1: Clone Repository

```bash
git clone https://github.com/Apollo-Level2-Web-Dev/ph-health-care-server.git
cd ph-health-care-server
```

#### Step 2: Checkout Dev Branch

```bash
git checkout dev
```

#### Step 3: Install Dependencies

```bash
pnpm install
```

**What This Does:**

- Installs all packages from `package.json`
- Automatically runs `postinstall` script
- Generates Prisma Client
- May show deprecation warnings (safe to ignore)

**Expected Output:**

```
Packages: +384
Progress: resolved 384, reused 384, downloaded 0, added 384, done
✔ Generated Prisma Client (v7.0.1) to ./node_modules/@prisma/client
```

#### Step 4: Create Environment File

```bash
cp .env.example .env
```

**Then edit `.env` with your values:**

```env
# Database (REQUIRED)
DATABASE_URL="postgresql://username:password@localhost:5432/ph_healthcare_dev?schema=public"

# JWT Secrets (REQUIRED)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_min_32_chars
RESET_PASS_TOKEN=your_reset_password_token_secret

# Email (REQUIRED for password reset)
EMAIL=your.email@gmail.com
APP_PASS=your_gmail_app_password

# Cloudinary (REQUIRED for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Stripe (REQUIRED for payments)
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# Frontend URL (REQUIRED)
FRONTEND_URL=http://localhost:3000

# OpenRouter (OPTIONAL - for AI features)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

**How to Get Stripe Keys:**

1. **Create Stripe Account**:

   - Go to https://stripe.com
   - Click "Sign up"
   - Complete registration

2. **Get Secret Key**:

   - Go to Dashboard → Developers → API Keys
   - Copy "Secret key" (starts with `sk_test_`)
   - Paste into `.env` as `STRIPE_SECRET_KEY`

3. **Get Webhook Secret** (Two Methods):

   **Method A: Stripe CLI (For Local Development)**

   ```bash
   # Install Stripe CLI
   # Windows: scoop install stripe
   # Mac: brew install stripe/stripe-cli/stripe
   # Linux: Download from https://github.com/stripe/stripe-cli/releases

   # Login
   stripe login

   # Start webhook forwarding
   stripe listen --forward-to localhost:5000/webhook

   # Copy the webhook signing secret (starts with whsec_)
   # Paste into .env as STRIPE_WEBHOOK_SECRET
   ```

   **Method B: Stripe Dashboard (For Production)**

   ```bash
   # 1. Go to Dashboard → Developers → Webhooks
   # 2. Click "Add endpoint"
   # 3. Enter endpoint URL: https://your-domain.com/webhook
   # 4. Select events: checkout.session.completed, checkout.session.expired
   # 5. Click "Add endpoint"
   # 6. Copy "Signing secret"
   # 7. Paste into .env as STRIPE_WEBHOOK_SECRET
   ```

**How to Get Cloudinary Keys:**

1. Go to https://cloudinary.com
2. Sign up / Log in
3. Dashboard shows:
   - Cloud Name
   - API Key
   - API Secret
4. Copy all three to `.env`

**How to Get Gmail App Password:**

1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Copy 16-character password (no spaces)
6. Paste as `APP_PASS` in `.env`

#### Step 5: Create Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ph_healthcare_dev;

# Exit
\q
```

**Or using GUI (DBeaver/pgAdmin):**

- Right-click → Create Database
- Name: `ph_healthcare_dev`
- Click Save

#### Step 6: Run Migrations

```bash
pnpm db:migrate dev --name initial_setup
```

**What This Does:**

- Creates all database tables
- Runs existing migrations
- Applies schema to database
- Updates Prisma Client

**Expected Output:**

```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema

Applying migration `20251116100917_new`
Applying migration `20251129133439_add_stripe_event_id_to_payment`

The following migration(s) have been applied:

migrations/
  └─ 20251116100917_new/
      └─ migration.sql
  └─ 20251129133439_add_stripe_event_id_to_payment/
      └─ migration.sql

✔ Generated Prisma Client
```

**If migration fails:**

```bash
# Drop database and recreate
psql -U postgres -c "DROP DATABASE ph_healthcare_dev;"
psql -U postgres -c "CREATE DATABASE ph_healthcare_dev;"

# Try again
pnpm db:migrate dev --name initial_setup
```

#### Step 7: Seed Database (Optional)

```bash
# If seed file exists
pnpm db:seed
```

**What This Does:**

- Creates initial admin user
- Populates test data
- Creates sample specialties

#### Step 8: Start Development Server

```bash
pnpm dev
```

**Expected Output:**

```
[INFO] 12:00:00 ts-node-dev ver. 2.0.0
[INFO] Using ts-node version 10.9.2
[INFO] Using typescript version 5.9.3
Server running on port 5000
```

#### Step 9: Verify Setup

```bash
# In another terminal
curl http://localhost:5000

# Expected response:
{"Message":"Ph health care server.."}
```

#### Step 10: Test Database Connection

```bash
# Open Prisma Studio
pnpm db:studio

# Opens browser at http://localhost:5555
# Should show all tables
```

---

### 🧪 Testing Stripe Integration

#### Option 1: Using Stripe CLI (Recommended)

**Terminal 1: Start Server**

```bash
pnpm dev
```

**Terminal 2: Start Stripe Webhook Forwarding**

```bash
stripe listen --forward-to localhost:5000/webhook
```

**Terminal 3: Test Payment**

```bash
# Create appointment via API (returns paymentUrl)
curl -X POST http://localhost:5000/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "doctorId": "doctor-uuid",
    "scheduleId": "schedule-uuid"
  }'

# Response:
{
  "success": true,
  "data": {
    "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}

# Open paymentUrl in browser
# Use test card: 4242 4242 4242 4242
# Any future expiry date
# Any CVC

# Terminal 2 will show webhook received:
webhook_received {
  type: 'checkout.session.completed',
  id: 'evt_xxxxx'
}
```

#### Option 2: Using Postman

1. Import `PH-HealthCare-API.postman_collection.json`
2. Set environment variables:
   - `baseUrl`: `http://localhost:5000`
   - `token`: Your JWT token (from login)
3. Run "Create Appointment" request
4. Copy `paymentUrl` from response
5. Open in browser, complete test payment

**Stripe Test Cards:**

```
Success:          4242 4242 4242 4242
Decline:          4000 0000 0000 0002
Insufficient:     4000 0000 0000 9995
Authentication:   4000 0025 0000 3155
```

---

### 🔍 Verifying Everything Works

#### Check 1: Database Tables

```bash
pnpm db:studio
```

**Expected Tables:**

- users
- admins
- doctors
- patients
- appointments
- payments (with `stripeEventId` column)
- doctor_schedules
- schedules
- specialties
- prescriptions
- reviews

#### Check 2: Prisma Client Generated

```bash
ls node_modules/@prisma/client

# Should show:
index.js
index.d.ts
runtime/
```

#### Check 3: Environment Variables Loaded

```bash
# In your code
import config from './config';
console.log('Stripe Key:', config.stripeSecretKey ? 'Loaded ✓' : 'Missing ✗');
console.log('DB URL:', config.database_url ? 'Loaded ✓' : 'Missing ✗');
```

#### Check 4: Stripe Connection

```bash
# Create test file: test-stripe.ts
import { stripe } from './src/helpers/stripe';

stripe.customers.list({ limit: 1 })
  .then(() => console.log('Stripe connected ✓'))
  .catch((err) => console.error('Stripe error:', err.message));

# Run
npx ts-node test-stripe.ts
```

#### Check 5: Cron Job Running

```bash
# Start server
pnpm dev

# Wait 5 minutes, should see in console:
🔄 Running unpaid appointment cleanup at 2025-11-29T12:05:00.000Z
```

---

## Testing Guide

### 🎯 Complete Payment Flow Test

#### 1. Create Patient Account

```bash
POST /api/v1/auth/register
{
  "name": "Test Patient",
  "email": "patient@test.com",
  "password": "password123",
  "role": "PATIENT"
}
```

#### 2. Login as Patient

```bash
POST /api/v1/auth/login
{
  "email": "patient@test.com",
  "password": "password123"
}

# Save token from response
```

#### 3. Get Available Doctors

```bash
GET /api/v1/doctors
Authorization: Bearer YOUR_TOKEN

# Pick a doctor ID from response
```

#### 4. Get Doctor Schedules

```bash
GET /api/v1/doctor-schedules?doctorId=DOCTOR_ID
Authorization: Bearer YOUR_TOKEN

# Pick an available schedule (isBooked: false)
```

#### 5. Create Appointment

```bash
POST /api/v1/appointments
Authorization: Bearer YOUR_TOKEN
{
  "doctorId": "DOCTOR_ID",
  "scheduleId": "SCHEDULE_ID"
}

# Response:
{
  "success": true,
  "data": {
    "paymentUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

#### 6. Complete Payment

```
1. Open paymentUrl in browser
2. Enter test card: 4242 4242 4242 4242
3. Expiry: Any future date
4. CVC: Any 3 digits
5. Click Pay
```

#### 7. Verify Payment Updated

```bash
# Check webhook received (server console):
✅ Payment paid for appointment xyz-123

# Check database:
pnpm db:studio

# payments table:
- status should be PAID
- stripeEventId should be populated
- paymentGatewayData should have session data

# appointments table:
- paymentStatus should be PAID
- status should be SCHEDULED
```

#### 8. Get My Appointments

```bash
GET /api/v1/appointments/my-appointments
Authorization: Bearer YOUR_TOKEN

# Should show appointment with paymentStatus: PAID
```

---

### 🧪 Testing Cron Job

#### Test Auto-Cancellation

**Setup:**

```sql
-- Manually create old unpaid appointment
INSERT INTO appointments (id, patient_id, doctor_id, schedule_id, video_calling_id, created_at, payment_status)
VALUES (
  gen_random_uuid(),
  'patient-id',
  'doctor-id',
  'schedule-id',
  gen_random_uuid(),
  NOW() - INTERVAL '31 minutes',  -- 31 minutes ago
  'UNPAID'
);
```

**Wait:**

- Wait up to 5 minutes for cron to run
- Check console: `🔄 Running unpaid appointment cleanup...`

**Verify:**

```sql
-- Appointment should be CANCELLED
SELECT status FROM appointments WHERE id = 'your-test-appointment-id';
-- Expected: CANCELLED

-- Schedule should be available again
SELECT is_booked FROM doctor_schedules WHERE schedule_id = 'your-schedule-id';
-- Expected: false
```

---

### 🔧 Testing Webhook Events

#### Test Session Completed

```bash
# Stripe CLI
stripe trigger checkout.session.completed

# Check console:
✅ Payment paid for appointment...
```

#### Test Session Expired

```bash
stripe trigger checkout.session.expired

# Check console:
⚠️ Checkout session expired: cs_test_...
```

#### Test Payment Failed

```bash
stripe trigger payment_intent.payment_failed

# Check console:
❌ Payment failed: pi_test_...
```

---

## Troubleshooting

### ❌ Common Issues & Solutions

#### Issue 1: "Cannot find module '@prisma/client'"

**Cause**: Prisma Client not generated

**Solution:**

```bash
pnpm db:generate
```

**If still fails:**

```bash
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

#### Issue 2: "Environment variable not found: DATABASE_URL"

**Cause**: `.env` file missing or not loaded

**Solution:**

```bash
# Check .env exists
ls -la .env

# If missing:
cp .env.example .env

# Edit .env with your DATABASE_URL
nano .env
```

**Verify loading:**

```typescript
import dotenv from "dotenv";
dotenv.config();
console.log("DB URL:", process.env.DATABASE_URL);
```

---

#### Issue 3: "Webhook signature verification failed"

**Cause**: Wrong webhook secret or body not raw

**Solutions:**

**A. Check webhook secret:**

```bash
# In .env
STRIPE_WEBHOOK_SECRET=whsec_...

# Must match Stripe CLI output:
stripe listen --forward-to localhost:5000/webhook
# > Ready! Your webhook signing secret is whsec_xyz123
```

**B. Verify route order in app.ts:**

```typescript
// ✅ CORRECT ORDER
app.post("/webhook", express.raw({ type: "application/json" }), handler);
app.use(express.json());

// ❌ WRONG ORDER
app.use(express.json());
app.post("/webhook", express.raw({ type: "application/json" }), handler);
```

---

#### Issue 4: "Migration failed: relation already exists"

**Cause**: Tables already exist in database

**Solution:**

```bash
# Option A: Reset database
pnpm db:migrate reset

# Option B: Drop and recreate
psql -U postgres -c "DROP DATABASE ph_healthcare_dev;"
psql -U postgres -c "CREATE DATABASE ph_healthcare_dev;"
pnpm db:migrate dev --name initial
```

---

#### Issue 5: "Prisma Client version mismatch"

**Cause**: Prisma version in node_modules doesn't match generated client

**Solution:**

```bash
pnpm db:generate
```

**If still fails:**

```bash
rm -rf node_modules
pnpm install
pnpm db:generate
```

---

#### Issue 6: "Pool connection timeout"

**Cause**: Database not running or wrong credentials

**Solution:**

```bash
# Check PostgreSQL running
# Windows:
services.msc  # Look for postgresql

# Mac:
brew services list | grep postgresql

# Linux:
systemctl status postgresql

# Test connection:
psql -U postgres -d ph_healthcare_dev

# If connection works but app doesn't, check .env:
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

---

#### Issue 7: "Stripe test mode charge failed"

**Cause**: Using live API key instead of test key

**Solution:**

```bash
# Check .env
STRIPE_SECRET_KEY=sk_test_...  # ✅ Test mode
STRIPE_SECRET_KEY=sk_live_...  # ❌ Live mode (don't use in development)

# Get test key from:
# Dashboard → Developers → API Keys → Secret key (Test mode)
```

---

#### Issue 8: "Cron job not running"

**Cause**: Server not started or cron syntax error

**Solution:**

```bash
# Check server console for cron messages
pnpm dev

# Should see every 5 minutes:
🔄 Running unpaid appointment cleanup at 2025-11-29T12:05:00.000Z

# If not appearing:
# 1. Check cron schedule syntax in app.ts
# 2. Check node-cron installed: pnpm list node-cron
# 3. Check no errors in AppointmentService.cancelUnpaidAppointments
```

---

#### Issue 9: "TypeScript errors in Old_Backend folder"

**Cause**: TypeScript trying to compile Old_Backend reference code

**Solution:**
Already fixed! Check `tsconfig.json`:

```json
{
  "exclude": ["node_modules", "Old_Backend"]
}
```

If still seeing errors:

```bash
# Restart TypeScript server in VS Code
Ctrl+Shift+P → TypeScript: Restart TS Server
```

---

#### Issue 10: "Payment status not updating"

**Diagnostic Steps:**

**A. Check webhook received:**

```bash
# Server console should show:
✅ Payment paid for appointment abc-123

# If not, check Stripe CLI:
stripe listen --forward-to localhost:5000/webhook
```

**B. Check for idempotency:**

```sql
SELECT stripe_event_id FROM payments WHERE appointment_id = 'your-id';
-- If populated, event already processed
```

**C. Check transaction errors:**

```bash
# Server console should show errors if any:
❌ Error processing webhook: ...
```

**D. Manual check:**

```bash
pnpm db:studio
# Check payments table:
# - stripe_event_id should be set
# - status should be PAID
# - payment_gateway_data should have session object
```

---

### 📊 Database Schema Reference

#### Key Tables & Relationships

```
users
├── email (unique)
├── password
└── role (ADMIN, DOCTOR, PATIENT)

patients
├── id
├── email → users.email
└── appointments[]

doctors
├── id
├── email → users.email
├── appointmentFee
└── appointments[]

appointments
├── id
├── patientId → patients.id
├── doctorId → doctors.id
├── scheduleId → schedules.id (unique)
├── paymentStatus (PAID, UNPAID)
├── status (SCHEDULED, COMPLETED, CANCELLED)
└── payment

payments
├── id
├── appointmentId → appointments.id (unique)
├── amount
├── transactionId (unique)
├── status (PAID, UNPAID)
├── stripeEventId (unique) ← NEW for idempotency
└── paymentGatewayData (JSON)

doctor_schedules
├── doctorId → doctors.id
├── scheduleId → schedules.id
└── isBooked (boolean)
```

---

### 🎓 Key Concepts Explained

#### What is Idempotency?

**Problem:**

```
User pays → Webhook sent → Server processes → Payment marked PAID
Network glitch → Stripe retries webhook → Server processes again → ???
```

**Without Idempotency:**

- Payment marked PAID twice
- Potential duplicate charges
- Database inconsistencies

**With Idempotency (Our Implementation):**

```typescript
// Check if event already processed
const existing = await prisma.payment.findFirst({
  where: { stripeEventId: event.id },
});

if (existing) {
  return "Already processed"; // Skip
}

// Process payment...
// Save stripeEventId to prevent future duplicates
```

**Result**: Same webhook can be sent 100 times, payment only updated once ✓

---

#### Why Transactions?

**Problem Scenario:**

```typescript
// Update appointment
await prisma.appointment.update({...});  // ✅ Success

// Server crashes here ⚠️

await prisma.payment.update({...});      // ❌ Never runs
```

**Result**: Appointment says PAID, Payment says UNPAID (inconsistent!)

**Solution with Transaction:**

```typescript
await prisma.$transaction(async (tx) => {
    await tx.appointment.update({...});
    await tx.payment.update({...});
});
// Either both succeed or both fail (rollback)
```

**Real-World Analogy:**
Bank transfer: Debit your account AND credit their account

- Both must succeed or neither (can't debit without crediting)
- Same concept with our payment updates

---

#### Why Webhook Instead of Redirect?

**Old Approach (SSLCommerz):**

```
User pays → SSL redirects to success_url?tran_id=xyz
Your server receives redirect → Validates with SSL API → Updates payment
```

**Problems:**

- User must complete redirect (what if they close browser?)
- Network issues during redirect = lost payment confirmation
- Can be manipulated (fake redirect URLs)

**New Approach (Stripe Webhook):**

```
User pays → Stripe sends webhook to your server directly
Your server validates signature → Updates payment
User redirected to success page (optional, for UX only)
```

**Benefits:**

- Payment confirmed even if user closes browser
- Direct server-to-server communication (more reliable)
- Cryptographically signed (can't be faked)
- Automatic retries if your server is down

---

### 📚 Additional Resources

**Stripe Documentation:**

- Testing: https://stripe.com/docs/testing
- Webhooks: https://stripe.com/docs/webhooks
- Checkout: https://stripe.com/docs/payments/checkout

**Prisma Documentation:**

- Prisma 7 Migration: https://www.prisma.io/docs/guides/upgrade-guides/upgrading-to-prisma-7
- Adapters: https://www.prisma.io/docs/orm/overview/databases/database-drivers
- Connection Pooling: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management

**Video Tutorials:**

- Stripe Webhooks: Search "Stripe webhooks Node.js" on YouTube
- Prisma Adapters: Check Prisma YouTube channel

---

### 🆘 Getting Help

**If you encounter issues:**

1. **Check server logs** - Most errors show detailed messages
2. **Check browser console** - For frontend errors
3. **Check Stripe Dashboard** - Webhooks → Events → See delivery status
4. **Check Prisma Studio** - Visual database inspection
5. **Enable verbose logging**:
   ```typescript
   // In prisma.ts
   const prisma = new PrismaClient({
     log: ["query", "info", "warn", "error"], // See all SQL queries
   });
   ```

**Still stuck?**

- Check Old_Backend folder for reference implementation
- Compare your code with Old_Backend line by line
- Verify .env variables match .env.example structure
- Try fresh install: `rm -rf node_modules && pnpm install`

---

## 🎉 Summary

### What You Now Have:

✅ **Modern Payment System**

- International payment support (Stripe)
- Secure webhook verification
- Idempotent payment processing
- Auto-cleanup of unpaid bookings

✅ **Latest Prisma**

- Prisma 7.0.1 with adapters
- Connection pooling for performance
- Better type safety
- Future-proof architecture

✅ **Production-Ready Code**

- Transaction-based updates
- Comprehensive error handling
- Environment-based configuration
- Detailed logging

✅ **Complete Documentation**

- Every change explained
- Setup instructions for new developers
- Testing guides
- Troubleshooting help

### Next Steps:

1. **Complete local testing** - Verify everything works
2. **Set up staging environment** - Test with real Stripe test mode
3. **Implement frontend** - Integrate payment URLs
4. **Add monitoring** - Track payment success/failure rates
5. **Deploy to production** - Use live Stripe keys

---

**Last Updated**: November 29, 2025
**Prisma Version**: 7.0.1
**Stripe SDK Version**: 19.1.0
**Node Version**: 18+ / 20+

---

Good luck! 🚀
