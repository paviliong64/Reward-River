<div align="center">

# 🌊 REWARD RIVER
### *Real Opinions. Real Value.*

  <p align="center">
    <a href="#-direct-downloadable-source-code-packages-zip"><b>Explore Downloads</b></a> •
    <a href="#-platform-system-architecture"><b>Architecture</b></a> •
    <a href="#-supabase-postgresql-database-setup-supabase-schemasql"><b>Database Setup</b></a> •
    <a href="#-vercel-deployment--supabaase-1-click-setup"><b>Vercel Deployment</b></a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/Settlement-USDT_(TRC20_%2F_ERC20)-26A17B?style=for-the-badge&logo=tether&logoColor=white" alt="Tether USDT" />
  </p>

</div>

---

> **Reward River** is an enterprise market research exchange and cryptocurrency rewards platform. Members participate in qualified market research surveys and instant tasks, accumulating points that convert into Tether USD (**USDT**) stablecoin payouts settled on TRON (TRC-20) or Ethereum (ERC-20).

---

## 👥 Co-Founders, Lead Engineers & Official Development Partner

<table align="center" width="100%">
  <tr>
    <td align="center" width="33%">
      <br />
      <b>🛠️ Rayan Mirza</b><br />
      <sub>Co-Founder, Lead Software Engineer, Systems Architect</sub><br />
      <a href="https://github.com/rynzer0x"><code>@rynzer0x</code></a>
    </td>
    <td align="center" width="33%">
      <br />
      <b>💡 Tahir Sanaullah</b><br />
      <sub>Co-Founder, Lead Software Engineer, Product Architect</sub><br />
      <code>Repository Owner</code>
    </td>
    <td align="center" width="33%">
      <br />
      <b>🌐 Injazify Partner</b><br />
      <sub>Official Platform Development & Support Partner</sub><br />
      <a href="https://www.injazify.com"><code>www.injazify.com</code></a>
    </td>
  </tr>
</table>

---

## 📥 Direct Downloadable Source Code Packages (ZIP)

Click any card below to download pre-packaged, ready-to-deploy ZIP archives directly from this repository:

<table width="100%">
  <tr>
    <td width="50%">
      <h3>📦 Full-Stack Complete Package</h3>
      <p>Complete end-to-end repository with React Vite frontend, Express API server, Supabase PostgreSQL adapter, CPX & AoyTasks webhooks, and Admin Console.</p>
      <a href="/downloads/reward-river-fullstack.zip"><b>⬇️ Download Full-Stack ZIP (.zip)</b></a>
    </td>
    <td width="50%">
      <h3>🎨 Frontend Only Source Code</h3>
      <p>Pure React 19 + TypeScript + Tailwind CSS UI components (User Dashboard, Surveys Marketplace, USDT Payout Portal, History, Settings, Article Documentation).</p>
      <a href="/downloads/reward-river-frontend.zip"><b>⬇️ Download Frontend ZIP (.zip)</b></a>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>⚙️ Backend Express API Engine</h3>
      <p>Node.js + Express API backend (<code>server.ts</code>, <code>server/db.ts</code>, S2S postbacks, MD5 signature verification, USDT price quotes, Supabase adapter).</p>
      <a href="/downloads/reward-river-backend.zip"><b>⬇️ Download Backend ZIP (.zip)</b></a>
    </td>
    <td width="50%">
      <h3>🛡️ Admin Portal Dedicated Package</h3>
      <p>Dedicated Admin Console UI layout & backend managers (<code>AdminView.tsx</code>, Partner Revenue & Accounting, CPX Manager, AoyTasks Manager, Withdrawal Queue).</p>
      <a href="/downloads/reward-river-admin-portal.zip"><b>⬇️ Download Admin Portal ZIP (.zip)</b></a>
    </td>
  </tr>
</table>

---

## 🏗️ Platform System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    REWARD RIVER PLATFORM                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
        │                                   │                                    │
        ▼                                   ▼                                    ▼
 🌐 REACT 19 FRONTEND               ⚙️ NODE/EXPRESS PROXY               ⚡ SUPABASE POSTGRESQL
  ├── White-Labeled UI               ├── CPX API Integration             ├── Supabase DB Engine
  ├── Live USDT Benchmark            ├── AoyTasks White-Label Engine     ├── PostgreSQL Tables
  ├── Interactive Ledger Views       ├── Double-Entry Ledger Store       └── Row Level Security
  └── On-Chain Wallet Submissions   └── S2S Postback Listener (`/api`)
```

---

## ✨ Visual Feature Showcases & Highlights

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h4>🎯 White-Labeled Survey & Task Marketplace</h4>
      <ul>
        <li><b>CPX Research API Integration</b>: Live surveys with MD5 cryptographic hash validation.</li>
        <li><b>AoyTasks White-Label PTC Engine</b>: Instant tasks, shortlinks, and PTC ads fully branded under Reward River.</li>
        <li><b>Dynamic User Revenue Split</b>: Admin controls exact points conversion rate (10,000 Pts = $1.00 USDT) and user profit share percentage.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>💸 Dual-Chain USDT Settlement Engine</h4>
      <ul>
        <li><b>TRON (TRC-20) & Ethereum (ERC-20)</b>: Automated address format validation for <code>T...</code> and <code>0x...</code> crypto wallets.</li>
        <li><b>Double-Entry Financial Ledger</b>: Prevents double-spend, holds pending withdrawal balances safely, and immutably records chargebacks.</li>
        <li><b>Live Tether Market Peg Feed</b>: Benchmark exchange rates sourced from CoinGecko.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>📄 Full-Screen Blog Documentation Pages</h4>
      <ul>
        <li><code>withdrawal-rules</code>: Payout limits, network fees, and settlement timelines.</li>
        <li><code>responsible-guidelines</code>: Respondent quality, anti-fraud rules, and survey completion tips.</li>
        <li><code>contact</code>: Help desk portal & missing credits support.</li>
        <li><code>terms</code> & <code>privacy</code>: Master terms of service and zero-KYC data protection safeguards.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🛡️ Dynamic Admin Control Portal</h4>
      <ul>
        <li><b>Zero-Config Supabase Credentials</b>: Enter and update Supabase Project URL and API Keys directly in the Admin UI!</li>
        <li><b>Partner Accounting Statements</b>: Review gross publisher revenue, user payouts, net admin profit, and completion logs.</li>
        <li><b>USDT Withdrawal Queue</b>: Review, approve, mark paid, and log blockchain TxHash receipts.</li>
      </ul>
    </td>
  </tr>
</table>

---

## ⚡ Supabase PostgreSQL Database Setup (`supabase-schema.sql`)

To set up your database in Supabase:

1. Create a project at [Supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase Dashboard.
3. Open `supabase-schema.sql` from this repository, copy its contents, paste into the SQL Editor, and click **Run**.
4. Retrieve your Supabase Project URL and API Keys from **Project Settings** → **API**.

---

## 🚀 Vercel Deployment & Supabase 1-Click Setup

1. Push your codebase to GitHub (`rynzer0x/reward-river`).
2. Go to [Vercel.com](https://vercel.com) → **New Project** → Select your repository.
3. In Vercel, go to **Storage** or **Marketplace** → Select **Supabase** → Click **Connect**.
4. Vercel automatically injects all Supabase environment variables into your deployment (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`).
5. Click **Deploy**.

---

## ⚙️ Environment Variables Reference (`.env.example`)

```env
# Server & Port
PORT=3000
NODE_ENV=production
JWT_SECRET=your_32_byte_secret_key

# Supabase PostgreSQL Database Configuration (Or manage from Admin Portal)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# CPX Research Publisher Credentials
CPX_APP_ID=37479
CPX_HASH_KEY=yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY

# AoyTasks White-Label Credentials
AOY_API_KEY=""
AOY_SECRET_KEY=""
AOY_BEARER_TOKEN=""

# USDT Withdrawal Thresholds
USDT_DEFAULT_NETWORK=TRC20
USDT_MIN_WITHDRAWAL_USD=25.00
USDT_MAX_WITHDRAWAL_USD=500.00
USDT_TRC20_FEE_USD=1.00
USDT_ERC20_FEE_USD=2.50
```

---

## 📡 API & Webhook Endpoints Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/cpx/postback` | `GET` | CPX Research S2S webhook listener (`status`, `trans_id`, `user_id`, `amount_usd`, `secure_hash`). |
| `/wh/aoytasks` | `GET` / `POST` | AoyTasks S2S webhook listener (`subId`, `transId`, `reward`, `secret_key`, returns `ok`). |
| `/api/surveys` | `GET` | Fetches live surveys from CPX Research API. |
| `/api/tasks` | `GET` | Fetches live white-labeled PTC ads and shortlinks from AoyTasks API. |
| `/api/usdt/price` | `GET` | Live Tether USD market peg quote. |
| `/api/ledger` | `GET` | Double-entry balance statement & ledger entries. |
| `/api/withdrawals` | `GET` / `POST` | Submit or review USDT withdrawal requests. |

---

<div align="center">
  <p>© 2026 <b>Reward River</b>. All rights reserved.</p>
  <p>Engineered with ❤️ by <b>Rayan Mirza</b>, <b>Tahir Sanaullah</b>, and <a href="https://www.injazify.com"><b>www.injazify.com</b></a>.</p>
</div>
