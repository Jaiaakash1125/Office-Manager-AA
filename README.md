# Office Manager 🏢
> **Production-Ready Accounting Office Management Platform**
> Built with Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres + Auth + RLS), and Vercel.

---

## 🌟 Key Architecture & Features

### 1. Role-Based Access Control (RBAC) & Row Level Security (RLS)
- **Admin**: Full access from any device (Live attendance roster, 30+ day overdue bills alerts, leads pipeline, staff user creation, password reset, manual attendance edits, and CSV data export).
- **Worker**: Dedicated streamlined portal (First login auto clock-in, telecalling result counters, interested lead capture modal, callback scheduler, itemized work logs, daily wrap-up note, and past attendance records).
- **Internal Username Mapping**: Staff and Admin log in using standard username + password (automatically mapped internally to `username@office.local` in Supabase Auth).

### 2. Precise Attendance & Smart Heartbeat Tracking
- **Server-Time Enforced**: Login and logout timestamps always originate on the server—never trusting client clocks.
- **Late Tag**: Automatic marking for clock-ins after 10:00 AM IST.
- **5-Minute Heartbeat**: Automatically pings `/api/attendance/heartbeat` while the dashboard is active and records elapsed active seconds (verifying user mouse/key activity within the last 10 minutes).
- **Browser Unload Warning**: Alerts staff if they try to close the tab without clocking out.
- **Automated Nightly Cleanup Cron**: Runs daily at 9:00 AM IST (`/api/cron/daily`), converting forgotten open sessions into estimated or auto-logout (7:00 PM) records.

### 3. Manual Invoicing & 30-Day Overdue Alerts
- Add manual bills with Client Name, Bill #, Amount, and Bill Date.
- **30+ Day Overdue System**: Outstanding pending bills older than 30 days are automatically highlighted with high-visibility **RED alerts** on the admin dashboard.
- One-click **"Mark Paid"** reconciliation.

### 4. Background Windows Python Tracker App
- Lightweight tracker script (`scripts/tracker.py`) for staff Windows PCs.
- Uses native `ctypes` Windows API to detect keyboard/mouse idle time and foreground application title.
- Sends active seconds every minute to `/api/tracker/heartbeat` using a secure per-user API token.
- Easily compiled into a standalone `.exe` with PyInstaller.

---

## 🚀 Quick Setup & Deployment Guide

### Step 1: Set Up Supabase Database & Auth

1. Log in to [Supabase](https://supabase.com) and create a new project.
2. In the left sidebar, click on **SQL Editor**.
3. Open the [`supabase/schema.sql`](./supabase/schema.sql) file from this repository, paste its entire contents into the SQL Editor, and click **Run**. This creates all tables, triggers, indexes, and RLS policies.
4. Next, open [`supabase/seed.sql`](./supabase/seed.sql), paste and run it. This will create your initial Admin account:
   - **Username**: `admin`
   - **Password**: `Admin@123`
   - *(You can change this password immediately upon first login)*

---

### Step 2: Configure Environment Variables

Create a `.env.local` file in the project root (or copy from `.env.example`):

```env
# From Supabase Project Settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Secret token for Vercel Cron protection (/api/cron/daily)
CRON_SECRET=my_secure_cron_passphrase_here

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

### Step 3: Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Log in with `admin` / `Admin@123`.
- Go to the **Staff Accounts** tab and create your 2 worker accounts (e.g., `priya`, `rahul`).

---

### Step 4: Deploy to Vercel

1. Push this repository to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Add New > Project**.
3. Import your GitHub repository.
4. In the **Environment Variables** section, add the four environment variables from Step 2:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
5. Click **Deploy**.
6. Vercel will build and deploy the application. The Vercel Cron defined in [`vercel.json`](./vercel.json) will automatically run `/api/cron/daily` at 9:00 AM IST every day.

---

### Step 5: Staff Windows Tracker App (Optional / Standalone)

For automatic background monitoring on staff Windows PCs:

1. Copy the [`scripts/tracker.py`](./scripts/tracker.py) file to the staff PC.
2. Create a `tracker_config.json` next to it:
   ```json
   {
     "server_url": "https://your-office-app.vercel.app",
     "api_token": "WORKER_API_TOKEN_FROM_ADMIN_PANEL",
     "check_interval_seconds": 60
   }
   ```
   *(Retrieve the worker's API token directly from the Admin Dashboard > Staff Accounts tab).*
3. To package as a background `.exe`:
   ```bash
   pip install requests pyinstaller
   pyinstaller --noconsole --onefile tracker.py
   ```
4. Place the generated `dist/tracker.exe` and `tracker_config.json` in Windows Startup folder (`shell:startup`) so it runs seamlessly on boot.

---

## 🔒 Security & Privacy Practices
- **Password Hashing**: Managed through Supabase Auth (bcrypt).
- **HTTPS Only**: All server communication is encrypted.
- **Server Clock Enforcement**: Prevents client clock spoofing for attendance and hours.
- **RLS Isolation**: Staff accounts are database-restricted from seeing other workers' data or sensitive office bills.
