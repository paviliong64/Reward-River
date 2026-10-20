# 🌊 Reward River — Turn Your Opinions Into USDT Rewards

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![USDT](https://img.shields.io/badge/Settlement-USDT_(TRC20_%2F_ERC20)-26A17B?style=for-the-badge&logo=tether&logoColor=white)](https://tether.to)

> **Reward River** is an enterprise-grade, white-labeled market research exchange and cryptocurrency rewards platform. Members participate in qualified market research surveys and earn real-time Tether USD (**USDT**) stablecoin rewards settled on-chain on TRON (TRC-20) or Ethereum (ERC-20).

---

## 👥 Co-Founders, Lead Engineers & Project Leadership

This platform is co-founded, engineered, and maintained by:

* 🛠️ **Rayan Mirza** ([@zeroxnetworks](https://github.com/zeroxnetworks))
  * *Co-Founder, Lead Software Engineer, Systems Architect & Repository Owner*
* 💡 **Tahir Sanaullah**
  * *Co-Founder, Lead Software Engineer, Product Architect & Repository Owner*

---

## 🏗 Platform System Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    REWARD RIVER PLATFORM                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
        │                                   │                                    │
        ▼                                   ▼                                    ▼
 🌐 REACT 19 FRONTEND               ⚙️ NODE/EXPRESS PROXY               🔥 FIREBASE ENGINE
  ├── White-Labeled UI               ├── CPX API Integration             ├── Auth (Google & Email)
  ├── Live USDT Benchmark            ├── MD5 Signature Verification      ├── Firestore Document Store
  ├── Interactive Ledger Views       ├── Double-Entry Ledger Store       └── Role-Based Access Rules
  └── On-Chain Wallet Submissions   └── S2S Postback Listener (`/api`)
```

---

## ✨ Key Capabilities & Innovations

- **White-Labeled Survey Marketplace**: Seamless integration with the official CPX Research API (`https://live-api.cpx-research.com`) fully white-labeled under the **Reward River** brand with zero third-party vendor leaks.
- **Cryptographic Server-to-Server (S2S) Postbacks**:
  - **`status=1`**: Confirmed survey completion -> Creates an authenticated `credit` ledger entry.
  - **`status=2` / `status=3`**: Cancellation / fraud reversal -> Creates a `reversal` debit entry referencing `{trans_id}` to reconcile balances safely.
  - **MD5 HMAC Verification**: Rejects forged webhooks via `md5(trans_id + '-' + hash_key)`.
- **Double-Entry Financial Ledger**:
  - Immutably logs every credit, debit, pending withdrawal hold, and chargeback.
  - Enforces double-spend locks and balance validation before processing withdrawals.
- **Dual-Chain USDT Settlement Engine**:
  - Supports **TRON (TRC-20)** ($1.00 network fee) and **Ethereum (ERC-20)** ($2.50 network fee).
  - Validates TRC-20 (`T...`) and ERC-20 (`0x...`) address formats on submission.
- **Live Tether Peg Feed**: Sourced from CoinGecko API (`/api/v3/simple/price`) to guarantee 1:1 USD-to-USDT conversion rate accuracy.

---

## ⚙️ Environment Variables Setup

Copy `.env.example` to `.env` and configure your production environment:

```env
# Server & Application Configuration
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.onrender.com
JWT_SECRET=your-secure-random-32-byte-hex-string

# CPX Research Publisher Credentials
CPX_APP_ID=37479
CPX_HASH_KEY=yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY
CPX_POSTBACK_SECRET=yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY

# USDT Payout & Network Configuration
USDT_DEFAULT_NETWORK=TRC20
USDT_MIN_WITHDRAWAL_USD=5.00
USDT_MAX_WITHDRAWAL_USD=500.00
USDT_TRC20_FEE_USD=1.00
USDT_ERC20_FEE_USD=2.50
USDT_PRICE_FEED_PROVIDER=coingecko

# Firebase Web Client Configuration (Optional / Client-side)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

---

## 🚀 Render Deployment Walkthrough

Deploying Reward River on [Render.com](https://render.com) takes less than 3 minutes:

1. **Connect Repository**:
   - Log into Render and click **New +** → **Web Service**.
   - Select your GitHub repository: `zeroxnetworks/reward-river`.

2. **Build & Runtime Settings**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

3. **Configure Environment Variables**:
   Under **Environment**, add the following keys:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `CPX_APP_ID`: `37479`
   - `CPX_HASH_KEY`: `yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY`
   - `CPX_POSTBACK_SECRET`: `yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY`
   - `JWT_SECRET`: *(Enter a secure random string)*

4. **Deploy**:
   Click **Create Web Service**. Render will build and launch your application.

---

## 🔗 CPX Research Postback Webhook Setup

In your [CPX Research Publisher Dashboard](https://publisher.cpx-research.com) under **Applications** → **Postback Settings**, paste the following URL format:

```text
https://YOUR-APP-NAME.onrender.com/api/cpx/postback?status={status}&trans_id={trans_id}&user_id={user_id}&sub_id={subid}&sub_id_2={subid_2}&amount_local={amount_local}&amount_usd={amount_usd}&offer_id={offer_ID}&hash={secure_hash}&ip_click={ip_click}
```

> **Note**: The Reward River server listens on `/api/cpx/postback`, `/api/cpx-postback`, and `/api/postback`, responding with HTTP `200 OK` and body `1` as expected by CPX verification tools.

---

## 💻 Local Development & Testing

```bash
# 1. Clone repository
git clone https://github.com/zeroxnetworks/reward-river.git
cd reward-river

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Start full-stack development server
npm run dev

# 5. Execute automated unit test suite (15 passing tests)
npm test
```

---

## 🔐 Privacy, Security & Compliance

- **Opaque User Isolation**: Survey networks only see anonymous hashes (`rr_cpx_...`). Member email addresses and personal identities are never exposed.
- **Cryptographic Signature Guards**: All incoming webhooks are validated against MD5 signature candidates before altering user ledger balances.
- **Firestore Security Rules**: Role-based access control (RBAC) ensures administrative commands are restricted strictly to authorized super-admins.

---

## 📜 License & Ownership

Developed, owned, and maintained jointly by **Rayan Mirza** ([@zeroxnetworks](https://github.com/zeroxnetworks)) & **Tahir Sanaullah**. All rights reserved.
