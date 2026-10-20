# 🌊 Reward River — Turn Your Opinions Into USDT Rewards

> **Reward River** is a full-stack market research exchange and crypto rewards platform. Members participate in market research surveys and earn confirmed Tether USD (**USDT**) stablecoin rewards settled on-chain on TRON (TRC-20) or Ethereum (ERC-20).

---

## 👥 Authors & Visionaries

This project is a collaboration:

* **Project Vision, Idea & Product Architecture**: Tahir Sanaullah
* **Lead Engineer & Repository Owner**: Rayan Mirza ([@zeroxnetworks](https://github.com/zeroxnetworks))

---

## ✨ Key Features

- **White-Labeled Market Research Engine**: Powered by CPX Research API with white-label branding for **Reward River**.
- **Cryptographic Server-to-Server Postbacks**: Handles real-time completion callbacks (`status=1`) and postback chargeback reversals (`status=2` / `status=3`) with MD5 signature validation.
- **Double-Entry Accounting Ledger**: Prevents double-spending, manages pending withdrawal holds, and recalculates available balances.
- **Dual-Chain USDT Settlements**: Support for TRON (TRC-20) and Ethereum (ERC-20) public wallet addresses.
- **Live Tether Peg Benchmark**: Real-time USD stablecoin peg verification sourced via CoinGecko API.
- **Firebase Auth & Firestore Sync**: Seamless persistent authentication (Google Sign-In, Email/Password, Email Verification) with role-based access control (RBAC).
- **Responsive Modern UI**: Built with React 19, Vite, Tailwind CSS, Lucide icons, and Motion.

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React Icons, Motion
- **Backend / API Proxy**: Node.js, Express, TypeScript (`tsx`)
- **Database & Auth**: Firebase Auth, Google Firestore, Local Double-Entry Ledger Store
- **Testing**: Native Node.js Test Runner (`node:test`)

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and populate your production credentials:

```env
# Server & Application
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.onrender.com
JWT_SECRET=your-random-32-character-secret-key

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

# Firebase Client Configuration (Optional)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
```

---

## 🚀 Deployment Instructions

### 1. Deploying on Render (Recommended)

1. **Push Code to GitHub**:
   Ensure your repository is pushed to your GitHub account (`@zeroxnetworks`).

2. **Create New Web Service on Render**:
   - Sign in to [Render.com](https://render.com).
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository (`reward-river` by `@zeroxnetworks`).

3. **Configure Build & Start Commands**:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Add Environment Variables**:
   Under **Environment**, add the keys listed in the `.env` section above:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `CPX_APP_ID`: `37479`
   - `CPX_HASH_KEY`: `yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY`
   - `CPX_POSTBACK_SECRET`: `yTrC9mntJwV1PSRJ5WdMbwMSel6qMheY`
   - `JWT_SECRET`: *(Generate a secure random string)*

5. **Deploy**:
   Click **Create Web Service**. Once deployed, copy your live service URL (e.g., `https://reward-river.onrender.com`).

---

### 2. Configuring Postback Webhooks in CPX Research Portal

Once your Render app is live:

1. Log into your [CPX Research Publisher Portal](https://publisher.cpx-research.com).
2. Go to **Applications** → **Postback Settings**.
3. Set your **Postback URL** format to:
   ```text
   https://YOUR-APP-NAME.onrender.com/api/cpx/postback?status={status}&trans_id={trans_id}&user_id={user_id}&sub_id={subid}&sub_id_2={subid_2}&amount_local={amount_local}&amount_usd={amount_usd}&offer_id={offer_ID}&hash={secure_hash}&ip_click={ip_click}
   ```
4. Click **Save** and test using CPX's built-in webhook tester tool.

---

### 3. Deploying on Railway / Vercel / Cloud Run / Docker

#### Docker Build
```bash
# Build Docker image
docker build -t reward-river .

# Run container
docker run -p 3000:3000 --env-file .env reward-river
```

---

## 💻 Local Development Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/zeroxnetworks/reward-river.git
   cd reward-river
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Create Local `.env` File**:
   ```bash
   cp .env.example .env
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Run Automated Test Suite**:
   ```bash
   npm test
   ```

---

## 🔐 Security & Privacy Architecture

- **Opaque User Identifiers**: Survey providers only receive anonymous opaque IDs (`rr_cpx_...`). Member email addresses are never disclosed.
- **MD5 Cryptographic Signatures**: Postback callbacks verify `md5(trans_id + '-' + hash_key)` before modifying ledger records.
- **Role-Based Access Control (RBAC)**: Firestore Security Rules restrict administration capabilities strictly to designated admin profiles.

---

## 📜 License & Credits

Created and maintained by **Rayan Mirza** ([@zeroxnetworks](https://github.com/zeroxnetworks)) based on the vision and product design by **Tahir Sanaullah**.
