# SlotPilot — Clinic Waitlist & No-Show Recovery

> **Automatically fill cancelled appointment slots via WhatsApp and SMS.**  
> A patient cancels → the next person on the waitlist gets a WhatsApp message → they reply YES → slot filled. No staff intervention needed.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-slotpilot--zeta.vercel.app-brightgreen)](https://slotpilot-zeta.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Live Demo

**URL:** [https://slotpilot-zeta.vercel.app](https://slotpilot-zeta.vercel.app)  
**Login:** `demo@slotpilot.com` / `demo1234`  
**Patient join page:** [https://slotpilot-zeta.vercel.app/join/city-physio](https://slotpilot-zeta.vercel.app/join/city-physio)

---

## The Problem

Small clinics lose **$88,000–$240,000/year** to no-shows and last-minute cancellations. Most have a paper waitlist or a spreadsheet. When a slot opens, staff manually call patients one by one — losing 20–40 minutes of admin time per slot, and often failing to fill it at all.

SlotPilot replaces that with a fully automated loop:

```
Slot cancelled or no-show
        ↓
Next matching patient on waitlist contacted via WhatsApp (or SMS)
        ↓
15-minute reply window: YES to book, NO to skip
        ↓
Slot booked → confirmation sent  ·  or  ·  Next patient offered automatically
```

---

## What's Working Today (Production)

- ✅ Clinic signup and dashboard
- ✅ Slot management (create, book, cancel, no-show)
- ✅ Patient waitlist via public `/join/[clinic-slug]` link — no account needed
- ✅ **WhatsApp + SMS outbound** via Twilio (one API for both channels)
- ✅ **Inbound replies** — patient replies YES/NO on WhatsApp → slot updates automatically
- ✅ **Cascade logic** — if patient doesn't reply in 15 min, next patient is offered
- ✅ **CANCEL handling** — patient texts CANCEL → slot re-opens → cascade restarts
- ✅ **Appointment reminders** — 24h and 2h before the appointment
- ✅ Deployed on Vercel + Turso (libsql cloud)

---

## How a Clinic Uses It

**1. Sign up** at `/signup` — takes 60 seconds  
**2. Share the join link** with patients — `your-app.vercel.app/join/your-clinic`  
**3. Add slots** to the calendar  
**4. When a slot opens** (cancellation or no-show) — click Cancel in the dashboard  
**5. SlotPilot handles the rest** — WhatsApp sent, reply tracked, slot filled or re-offered

Staff involvement after setup: **one click per cancellation.**

---

## WhatsApp Flow (Live)

Patient receives:
> *Hi Rahul! A General Consultation slot opened at City Physio Clinic on 20/07/2026 at 11:00am. Reply YES to confirm or NO to skip. Offer expires in 15 minutes.*

On YES:
> *Confirmed! Your General Consultation appointment at City Physio Clinic is booked for 20/07/2026 at 11:00am. See you then!*

On CANCEL (any time before appointment):
> *Your appointment has been cancelled. We'll let you know if another slot opens up.*

---

## Messaging Providers

| Provider | Channels | Best For |
|---|---|---|
| **Twilio** | WhatsApp + SMS | Default — single API for both, easy sandbox testing |
| **Meta Cloud API** | WhatsApp only | 1,000 free conversations/month in production |
| **MSG91** | SMS | India-specific — DLT-registered sender IDs |
| **Console** | Logs to stdout | Local development, no credentials needed |

Switch providers with one env var: `MESSAGE_PROVIDER=twilio`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| Database | Turso (libsql cloud) via Prisma 7 + libsql adapter |
| Auth | JWT sessions via jose — stateless httpOnly cookies, 7-day expiry |
| Styling | Tailwind CSS v4 |
| Messaging | Twilio (WhatsApp + SMS) / Meta Cloud API / MSG91 |
| Cron | cron-job.org (free) — cascade every 5 min, reminders every 15 min |
| Hosting | Vercel (Hobby tier) |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/            # Login, signup, session, logout
│   │   ├── slots/[id]/      # CRUD + status transitions (cancel, no-show, book)
│   │   ├── waitlist/        # Patient waitlist management
│   │   ├── webhooks/
│   │   │   ├── sms/         # Twilio inbound (WhatsApp + SMS replies)
│   │   │   └── meta/        # Meta Cloud API inbound webhook
│   │   ├── cron/
│   │   │   ├── cascade/     # Re-offer expired slots to next patient
│   │   │   └── reminders/   # Send 24h + 2h appointment reminders
│   │   └── clinic/          # Clinic profile settings
│   ├── dashboard/           # Clinic UI — slots, waitlist, messages
│   ├── join/[slug]/         # Public patient waitlist page
│   └── signup/              # Clinic self-registration
├── lib/
│   ├── db.ts                # Prisma + libsql client (local file or Turso)
│   ├── session.ts           # JWT cookie auth
│   ├── sms.ts               # Multi-provider messaging abstraction
│   └── waitlist-engine.ts   # Core cascade + reminder logic
└── generated/
    └── prisma/              # Generated Prisma client
```

### Cascade Flow

```
Slot cancelled / no-show
        ↓
waitlist-engine: find next waiting patient (by appointmentType + priority + createdAt)
        ↓
sendMessage() → Twilio WhatsApp or SMS → notification saved to DB
        ↓
Patient replies YES  →  slot.status = "booked", confirmation sent
Patient replies NO   →  cascade to next patient
No reply in 15 min  →  cron/cascade picks it up, cascades to next patient
Patient texts CANCEL →  slot re-opened, cascade restarts
```

---

## Getting Started Locally

```bash
git clone https://github.com/hkpritiranjan/slotpilot.git
cd slotpilot
npm install
npx prisma db push
```

Create `.env.local`:

```env
DATABASE_URL="file:./prisma/slotpilot.db"
SESSION_SECRET="any-32-char-string-here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MESSAGE_PROVIDER=console
CRON_SECRET=local-dev-cron-secret
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up for a new clinic account.

---

## Deploying to Production

### 1. Database — Turso (free tier)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create slotpilot
turso db show slotpilot --url        # → LIBSQL_URL
turso db tokens create slotpilot     # → LIBSQL_AUTH_TOKEN
```

Push schema to Turso:
```bash
LIBSQL_URL=<your-url> npx prisma db push
```

### 2. Vercel

```bash
npm i -g vercel
vercel --prod
```

Set these env vars in the Vercel dashboard:

```env
LIBSQL_URL=libsql://slotpilot-yourname.aws-eu-west-1.turso.io
LIBSQL_AUTH_TOKEN=your-token
SESSION_SECRET=<random-32-chars>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
MESSAGE_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM=+1xxxxxxxxxx
TWILIO_WHATSAPP_FROM=+14155238886
CRON_SECRET=<random-string>
```

### 3. Twilio Inbound Webhook

Twilio Console → **Messaging → Try it out → Send a WhatsApp message → Sandbox settings**:

- **When a message comes in:** `https://your-app.vercel.app/api/webhooks/sms`
- Method: `HTTP POST`

### 4. Cron Jobs — cron-job.org (free)

| Endpoint | Schedule | Header |
|---|---|---|
| `/api/cron/cascade` | Every 5 minutes | `x-cron-secret: <your-CRON_SECRET>` |
| `/api/cron/reminders` | Every 15 minutes | `x-cron-secret: <your-CRON_SECRET>` |

---

## Problem Scale

Healthcare appointment no-shows cost the US system an estimated **$150 billion/year**.

| Specialty | Average No-Show Rate |
|---|---|
| Physiotherapy | 10–14% |
| Dental | 15–20% |
| Chiropractic | 14–18% |
| Mental Health | 18–28% |

SlotPilot targets the **350,000+ small clinics (1–5 practitioners)** in the US, UK, India, and Canada — underserved by enterprise solutions ($299+/month) and too complex for generic booking tools.

---

## Roadmap

- [ ] Clinic onboarding wizard (branding, appointment types, working hours)
- [ ] Patient opt-out / STOP handling
- [ ] Analytics dashboard (fill rate, average fill time, revenue recovered)
- [ ] Multi-location support
- [ ] Google Calendar / iCal sync
- [ ] HIPAA-compliant hosting option (AWS + BAA)
- [ ] White-label / embeddable widget for existing PMS systems
- [ ] Meta Cloud API production approval (1,000 free conversations/month)

---

## For Healthcare Companies & Investors

If you're a clinic management platform, PMS vendor, or healthcare investor evaluating this technology:

- Full working codebase — not a mockup
- Live production deployment with real Twilio WhatsApp integration tested end-to-end
- Designed to embed into existing workflows via a single API endpoint per trigger
- Multi-region messaging: Twilio (global), MSG91 (India DLT-compliant), Meta Cloud API
- The full working system — auth, scheduling, waitlist engine, WhatsApp/SMS, reminders, webhooks — is under 2,500 lines of code

**Contact:** [pritiranjan.swain@viavisolutions.com](mailto:pritiranjan.swain@viavisolutions.com)

---

## License

MIT

---

*Keywords: healthcare SaaS, clinic management software, appointment scheduling, patient waitlist management, no-show reduction, WhatsApp healthcare notifications, SMS appointment reminders, practice management system, physiotherapy software, dental clinic software, chiropractic management, patient engagement platform, healthcare workflow automation, HIPAA-ready scheduling, small clinic software, Next.js healthcare, TypeScript medical software, Twilio WhatsApp healthcare, waitlist automation, revenue cycle management, India healthcare tech, MSG91 DLT, appointment recovery, clinic operations software*
