# 💰 Budgeto

### Take Control of Your Money.

Budgeto is a modern, offline-first personal finance application designed to make managing money simple, intuitive, and accessible. Track income and expenses, manage multiple wallets, set budgets, organize recurring bills, build savings, and understand your financial habits through a clean and minimalist interface.

Free to use, ad-free, and designed to keep your finances accessible even without an internet connection.

## ✨ Features

- **Smart Dashboard** — Monitor your total balance, monthly income and expenses, and remaining daily budget until payday with real-time financial status indicators.
- **Quick Transactions** — Record income and expenses through a streamlined interface with a native-style numeric keypad and smart category suggestions.
- **Recurring Bills** — Manage regular payments such as rent, internet, and subscriptions with automatic or confirmation-based recording and duplicate prevention.
- **Flexible Payday** — Set your payday from the 1st to the 31st and organize financial periods around your personal payment schedule.
- **Multi-Wallet Management** — Organize cash, bank accounts, and e-wallets while supporting transfers between wallets.
- **Smart Budgeting** — Set category-based spending limits and monitor progress with warnings at 80% and 100% usage.
- **Savings Goals** — Create savings targets, record regular contributions, and track progress toward your financial goals.
- **Transaction Management** — Search, filter, delete, and undo transaction changes with ease.
- **Financial Analytics** — Explore six-month spending trends, category breakdowns, daily activity, and financial insights.
- **Reminders & Notifications** — Receive transaction notifications, budget warnings, and daily reminders.
- **App Lock** — Protect access to the application using a PIN stored as a PBKDF2-derived hash rather than plain text.
- **Bilingual Interface** — Switch between Indonesian and English directly from the settings.
- **Customizable Appearance** — Choose between dark and light modes and six accent colors.
- **Offline-First Experience** — Access locally stored financial data without an internet connection using IndexedDB.
- **Optional Cloud Sync** — Back up and synchronize financial data across devices through Supabase.
- **Progressive Web App (PWA)** — Install Budgeto from a supported browser for an app-like experience.
- **Android App & Widget** — Use the Android application and home-screen widget for balance information and quick transaction actions.
- **Data Portability** — Import and export JSON backups and export transaction records to CSV.

## 🚀 Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)

### Installation

Clone the repository:

```bash
git clone https://github.com/avoocreator/budgeto.git
cd budgeto
```

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build the application:

```bash
bun run build
```

Start the production server:

```bash
bun run start
```

## 📖 How to Use Budgeto

### 1. Set Up Your Finances

Configure your preferred language, appearance, payday, and other application settings. Create wallets to organize your available funds.

### 2. Record Transactions

Add income and expenses, select a wallet and category, and include notes when needed. Use the quick transaction interface to record daily financial activity.

### 3. Manage Budgets and Bills

Set spending limits for individual categories and monitor budget usage through the dashboard. Add recurring bills to organize regular payments and configure how they are recorded.

### 4. Track Savings Goals

Create financial targets, record contributions, and monitor your progress toward each savings goal.

### 5. Review Financial Insights

Use reports and charts to understand spending patterns, review cash flow, and identify opportunities to improve your financial habits.

### 6. Protect and Manage Your Data

Enable the app lock to protect access to your finances. Export backups regularly and configure optional cloud synchronization when you need to access your data across devices.

## 🎨 Design Philosophy

Budgeto emphasizes simplicity, clarity, and functionality. Its compact, minimalist interface keeps essential financial information accessible without unnecessary visual clutter.

The application combines practical financial tools with customizable themes, bilingual support, and streamlined interactions to make daily money management more approachable.

## 🔒 Privacy & Data

Budgeto follows an offline-first approach, storing financial data locally using IndexedDB. Core local data management does not require a continuous internet connection.

Cloud synchronization is optional and powered by Supabase. Supabase authentication and Row Level Security (RLS) help protect user data when cloud features are configured.

The app lock uses PBKDF2-based PIN hashing instead of storing the PIN as plain text. Users should still protect their devices, secure their cloud credentials, and maintain their own backups.

## 🛠️ Built With

- **Next.js** — Application framework
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Styling and responsive layouts
- **shadcn/ui** — Interface components
- **Dexie.js** — Local IndexedDB storage
- **Supabase** — Optional authentication and cloud synchronization
- **Recharts** — Financial charts and analytics
- **next-themes** — Theme management
- **Capacitor** — Android application integration
- **GitHub Actions** — Automated Android builds

## 🎯 Our Goal

Budgeto aims to make personal finance management more approachable by combining practical financial tools, thoughtful design, offline accessibility, and user-focused privacy in one application.

**Budgeto — Understand your money. Build better habits.**

