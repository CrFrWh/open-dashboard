# Open Dashboard

A **modular, extensible dashboard system** for ingesting, querying, and visualizing data from CSV, JSON, APIs, PDF, and plain text.  
Designed to be fully **generic**, **headless**, and suitable for building **custom dashboards** or embedding as **NPM packages**.

![Open Dashboard Demo](./docs/demo-preview.png)

## 🚀 Features

- **Multi-format data ingestion**: CSV, JSON, API, PDF, plain text
- **Schema inference & normalization**: Automatically detect column types and normalize data
- **Flexible query engine**: Built-in DuckDB integration for joining multiple datasets on-the-fly
- **Composable UI components**: Headless React widgets (Tables, Charts, Metric Cards)
- **Dashboard builder**: Grid layout system for composing widgets and dashboards
- **Exportable & modular**: Save dashboards as JSON or Parquet; easily extend adapters and widgets
- **Open-source & framework-agnostic**: Works locally, in demos, or embedded in other apps

## 📦 Project Structure

```
open-dashboard/
├── packages/              # Core library packages (publishable to NPM)
│   ├── core-parser/       # CSV, JSON, PDF, Text, API adapters
│   ├── core-schema/       # Schema inference, Arrow/Parquet conversion
│   ├── core-query/        # DuckDB query engine wrapper
│   ├── ui-widgets/        # Table, Chart, Metric Card components
│   └── dashboard-builder/ # Compose widgets + layout orchestration
├── apps/
│   └── demo/              # Interactive demo application
├── shared/                # Common types and utilities
└── examples/              # Usage examples and tutorials
```

## 🏃‍♂️ Quick Start

### Try the Demo

```bash
# Install dependencies
bun install

# Start the demo
bun run dev
```

Visit `http://localhost:5173` to see the interactive demo.

### Development

```bash
# Install all dependencies
bun install

# Start demo in development mode
bun run dev:demo

# Build all packages (coming soon)
bun run build:packages

# Run linting
bun run lint
```

## 🎯 Demo Features

The demo application showcases:

- **File Upload**: Drag & drop CSV/JSON files
- **Sample Datasets**: Pre-loaded sales, employee, and product data
- **Data Preview**: Interactive table view with schema information
- **Coming Soon**: Query builder, chart widgets, dashboard composition

## 🛣️ Roadmap

- [x] **Phase 0**: Project foundation (Vite + React 19 + TypeScript)
- [ ] **Phase 1**: CSV/JSON ingestion, Arrow/Parquet, Table/Chart widget (6-8 weeks)
- [ ] **Phase 2**: PDF/Text/API adapters, multi-dataset joins (6 weeks)
- [ ] **Phase 3**: Advanced widgets, dashboard export, NPM packages (4-6 weeks)
- [ ] **Phase 4**: Community contributions: new adapters, query engines, widgets

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

- Add new **adapters** (XML, Excel, etc.)
- Add new **widgets** (maps, custom charts)
- Improve **query engine** support (Polars, SQLite)
- Fix bugs, improve docs, add tests

## 🏗️ Architecture

```
User Input (CSV/JSON/API/PDF/Text)
           ↓
    Parser Layer (Adapters)
           ↓
  Schema Inference & Normalization
           ↓
    Storage (Arrow/Parquet)
           ↓
    Query Engine (DuckDB)
           ↓
    UI Widgets (React Components)
           ↓
    Dashboard Builder (Layout + Composition)
```

## ⚡ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite (rolldown-vite)
- **Styling**: Tailwind CSS (coming soon)
- **Data Processing**: Apache Arrow, DuckDB, Parquet
- **Parsing**: PapaParse (CSV), native JSON, pdf-parse (PDF)
- **Build**: Bun + Turbo (monorepo)

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

Built with ❤️ using modern TypeScript, React 19, and rolldown-vite for maximum performance.
