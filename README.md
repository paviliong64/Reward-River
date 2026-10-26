# 🌊 Reward River — Real Opinions. Real Value.

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![USDT](https://img.shields.io/badge/Settlement-USDT_(TRC20_%2F_ERC20)-26A17B?style=for-the-badge&logo=tether&logoColor=white)](https://tether.to)

> **Reward River** is an enterprise market research exchange and cryptocurrency rewards platform. Members participate in qualified market research surveys and instant tasks, accumulating points that convert into Tether USD (**USDT**) stablecoin payouts settled on TRON (TRC-20) or Ethereum (ERC-20).

---

## 📥 Direct Downloadable Source Code Packages (ZIP)

Click any link below to download pre-packaged, ready-to-deploy ZIP archives directly from this repository:

| Package | Description | Direct Download Link |
| :--- | :--- | :--- |
| 📦 **Full-Stack Complete Application** | Complete repository with React Vite frontend, Express API server, LowDB persistent ledger, CPX & AoyTasks webhooks, and Admin Console. | [Download Full-Stack ZIP](/downloads/reward-river-fullstack.zip) |
| 🎨 **Frontend Only Source Code** | Pure React 19 + TypeScript + Tailwind CSS UI components (User Dashboard, Surveys Marketplace, USDT Payout Portal, History, Settings, Article Documentation). | [Download Frontend ZIP](/downloads/reward-river-frontend.zip) |
| ⚙️ **Backend Only Express API Engine** | Node.js + Express API backend (`server.ts`, `server/db.ts`, S2S postbacks, MD5 verification, USDT price quotes, PBKDF2 authentication). | [Download Backend ZIP](/downloads/reward-river-backend.zip) |
| 🛡️ **Admin Portal Dedicated Package** | Dedicated Admin Console UI layout & backend managers (`AdminView.tsx`, Partner Revenue & Accounting, CPX Manager, AoyTasks Manager, Withdrawal Queue). | [Download Admin Portal ZIP](/downloads/reward-river-admin-portal.zip) |

---

## 👥 Co-Founders, Lead Engineers & Official Development Partner

This platform is co-founded, engineered, and maintained by:

* 🛠️ **Rayan Mirza** ([@zeroxnetworks](https://github.com/zeroxnetworks))
  * *Co-Founder, Lead Software Engineer, Systems Architect & Repository Owner*
* 💡 **Tahir Sanaullah**
  * *Co-Founder, Lead Software Engineer, Product Architect & Repository Owner*
* 🌐 **Official Development, Contact & Support Partner**: [www.injazify.com](https://www.injazify.com)
  * *Official Platform Development, Support & Business Operations*

---

## 🏗️ Platform System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    REWARD RIVER PLATFORM                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
        │                                   │                                    │
        ▼                                   ▼                                    ▼
 🌐 REACT 19 FRONTEND               ⚙️ NODE/EXPRESS PROXY               🔥 FIREBASE ENGINE
  ├── White-Labeled UI               ├── CPX API Integration             ├── Auth (Email & Password)
  ├── Live USDT Benchmark            ├── AoyTasks White-Label Engine     ├── Firestore Document Store
  ├── Interactive Ledger Views       ├── Double-Entry Ledger Store       └── Role-Based Access Rules
  └── On-Chain Wallet Submissions   └── S2S Postback Listener (`/api`)
```

---

## ✨ Key Features & Technical Innovations

- **White-Labeled Survey & Task Feeds**:
  - CPX Research API integration with MD5 signature validation.
  - AoyTasks 100% white-label PTC and shortlinks integration (`aoyco.in` endpoints with MD5 verification and lowercase `ok` / `DUP` responses).
- **Double-Entry Financial Ledger**:
  - Immutably records every credit, pending reservation hold, withdrawal settlement, and chargeback.
  - Enforces double-spend locks and balance validation before processing payouts.
- **Dual-Chain USDT Settlement Engine**:
  - Supports **TRON (TRC-20)** ($1.00 network fee) and **Ethereum (ERC-20)** ($2.50 network fee).
  - Validates TRC-20 (`T...`) and ERC-20 (`0x...`) address formats on submission.
- **Full-Screen Article Documentation System**:
  - Replaced popup modals with full-screen, rich blog-style documentation pages:
    - `withdrawal-rules`: Complete USDT withdrawal guide & network comparison.
    - `responsible-guidelines`: Respondent quality & demographic rules.
    - `contact`: Support portal & contact details.
    - `terms`: Master terms of service & platform governance.
    - `privacy`: Data protection & zero-KYC safeguards.
- **Admin Control Console**:
  - Admin Profit & User Share Controller (default 40% user share / 60% hidden admin profit).
  - Live CPX Research Manager & Postback Simulator.
  - Live AoyTasks Manager & White-Label Postback Simulator.
  - USDT Withdrawals Processing Queue with TxHash recording.
  - Registered Users Directory & WhatsApp Onboarding Manager.

---

## ⚙️ Environment Variables Configuration (`.env`)

Copy `.env.example` to `.env` and set your credentials:

```env
# Server & Port
PORT=3000
NODE_ENV=production
JWT_SECRET=your_32_byte_secret_key

# CPX Research Integration
CPX_APP_ID=37479
CPX_HASH_KEY=yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY

# AoyTasks White-Label Integration
AOY_API_KEY=your_aoyco_api_key
AOY_SECRET_KEY=your_aoyco_secret_key
AOY_BEARER_TOKEN=your_aoyco_bearer_token

# USDT Withdrawal Thresholds
USDT_MIN_WITHDRAWAL_USD=25.00
USDT_MAX_WITHDRAWAL_USD=500.00
USDT_TRC20_FEE_USD=1.00
USDT_ERC20_FEE_USD=2.50
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher

### Local Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Run dev server (Express backend + Vite frontend)
npm run dev

# 3. Build production bundle
npm run build

# 4. Start production server
npm start
```

Open `http://localhost:3000` in your web browser.

---

## 📡 API & Postback Webhook Endpoints

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

## 🛡️ Admin Portal Guide

- **Admin Access**: Log in with an account having role `admin`.
- **Navigation**: Click **Admin** in the header navigation menu.
- **Key Modules**:
  1. **Partner Revenue & Accounting**: Financial statements, gross partner earnings, user payouts, net admin profit.
  2. **Points & Profit Controller**: Set points exchange rate (default 10,000 Pts = $0.40 USDT) and user share percent.
  3. **CPX Research Manager**: Placement settings, postback URL generator, and completion simulator.
  4. **AoyTasks Manager**: API credentials, S2S endpoint config, and PTC postback simulator.
  5. **USDT Withdrawals Queue**: Review, approve, mark paid, and record blockchain TxHash.
  6. **Users Directory**: Search users, inspect points & USDT balances, and view WhatsApp contacts.

---

## 📄 License & Attribution

© 2026 **Reward River**. All rights reserved.  
Maintained by **Rayan Mirza**, **Tahir Sanaullah**, and [www.injazify.com](https://www.injazify.com).
