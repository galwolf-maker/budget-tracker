# BudgetTrack — Personal Finance Tracker

A clean, responsive personal budget tracking app built with React, TypeScript, and Vite. All data is stored in your browser's localStorage — no backend required.

## Running Locally

### Prerequisites
- Node.js 18+ (https://nodejs.org)
- npm 9+

### Steps

```bash
# 1. Navigate to the project directory
cd budget-tracker

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Features

- **Dashboard** — Summary cards (balance, income, expenses, this month's spending), expense pie chart, monthly income vs. expenses bar chart, and recent transactions
- **Transactions** — Full list with search, filter by type/category/month, inline edit and delete (with confirmation)
- **Categories** — View default categories; add and delete custom ones for both income and expense
- **CSV Export** — Download all transactions as a `.csv` file
- **CSV Import** — Upload a `.csv` with columns `date, type, category, amount, description` to bulk-import transactions
- **Persistence** — Everything is stored in `localStorage` under keys `bt-transactions` and `bt-categories`

## CSV Import Format

```csv
date,type,category,amount,description
2024-03-15,expense,Food,42.50,Grocery run
2024-03-14,income,Salary,3500.00,March paycheck
```

- `date` — `YYYY-MM-DD`
- `type` — `income` or `expense`
- `category` — any string (will be stored as-is)
- `amount` — positive number
- `description` — optional free text

## Tech Stack

- [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — build tool
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Recharts](https://recharts.org) — charts
- [Lucide React](https://lucide.dev) — icons
