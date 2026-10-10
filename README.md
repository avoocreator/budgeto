# 💰 Budgeto

### Take Control of Your Money.

Budgeto is a modern, offline-first personal finance application designed to make managing money simple, intuitive, and accessible. Track income and expenses, manage multiple wallets, set budgets, build savings, and understand your financial habits through a clean and minimalist interface.

Free to use, ad-free, and designed to keep your finances accessible even without an internet connection.

## ✨ Features

- **Financial Dashboard** — View your total balance, monthly income and expenses, budgets, and savings goals in one place.
- **Quick Transactions** — Record income and expenses with a streamlined transaction interface.
- **Multi-Wallet Management** — Organize cash, bank accounts, and e-wallets while supporting transfers between wallets.
- **Smart Budgeting** — Set category-based budgets and monitor spending with progress indicators and notifications at 80% and 100% usage.
- **Savings Goals** — Create savings targets, track contributions, and monitor your progress toward financial goals.
- **Financial Analytics** — Explore spending breakdowns, daily activity, six-month trends, and financial insights.
- **Reminders & Notifications** — Stay informed about transactions, budget limits, and daily financial routines.
- **Offline-First Experience** — Manage locally stored financial data without an internet connection.
- **Optional Cloud Sync** — Synchronize and back up financial data across devices using Supabase.
- **Progressive Web App** — Install Budgeto from a supported browser for an app-like experience.
- **Android Widget** — Access balance information and quick transaction actions from your home screen.
- **Data Portability** — Import and export JSON backups and export transactions to CSV.
- **Personalized Appearance** — Switch between dark and light themes.

## 🚀 Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)

### Installation

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/avoocreator/budgeto.git
cd budgeto
```

Install the dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build the application for production:

```bash
bun run build
```

To serve the generated production output locally:

```bash
bun run start
```

## 📖 How to Use Budgeto

**1. Set Up Your Wallets**

Create wallets to organize your available funds, such as cash, bank accounts, and e-wallets.

**2. Record Your Transactions**

Add income and expenses, assign categories, select the appropriate wallet, and include additional details when needed.

**3. Manage Your Budgets**

Create spending limits for different categories and monitor your usage through the dashboard.

**4. Track Your Savings**

Set financial goals, record contributions, and monitor your progress toward each target.

**5. Analyze Your Finances**

Use reports and visualizations to understand spending patterns, review cash flow, and identify areas where you can improve your financial habits.

**6. Manage Your Data**

Export your financial records for backup or further analysis. Configure optional cloud synchronization when you need to access your data across devices.

## 🎨 Design Philosophy

Budgeto emphasizes simplicity, clarity, and functionality. Its compact, minimalist interface keeps essential financial information accessible without unnecessary visual clutter.

Every interaction is designed to make recording transactions and understanding personal finances feel straightforward, encouraging consistent and informed financial habits.

## 🔒 Privacy & Data

Budgeto follows an offline-first approach, using IndexedDB for local data storage. Core local data management does not require a continuous internet connection.

Cloud synchronization is optional and powered by Supabase. Its authentication and Row Level Security (RLS) capabilities help protect user data when cloud features are configured.

Users should maintain their own backups and protect any credentials associated with their cloud configuration.

## 🛠️ Built With

- **Next.js** — Application framework
- **TypeScript** — Type-safe development
- **Tailwind CSS** — Styling and responsive layouts
- **shadcn/ui** — Interface components
- **Dexie.js** — Local IndexedDB storage
- **Supabase** — Optional authentication and cloud synchronization
- **Recharts** — Financial charts and analytics
- **next-themes** — Dark and light theme management
- **Capacitor** — Android application integration
- **GitHub Actions** — Automated Android builds

## 🎯 Our Goal

Budgeto aims to make personal finance management more approachable by combining practical financial tools, thoughtful design, offline accessibility, and user-focused privacy in one application.

**Budgeto — Understand your money. Build better habits.**
