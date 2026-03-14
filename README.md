# Philippine Statistics Dashboard

An interactive web dashboard for visualizing Philippine statistics with advanced mapping capabilities, built with Vue 3, TypeScript, and ECharts.

## Features

- **Interactive Maps**: Geographic visualization of Philippine data using ECharts
- **Data Import**: Support for Excel (.xlsx, .xls) and CSV files
- **Google Sheets Integration**: Live data synchronization with Google Sheets
- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Real-time Updates**: Dynamic data visualization with Pinia state management
- **Type Safety**: Full TypeScript implementation with strict mode

## Tech Stack

- **Frontend**: Vue 3.5+ (Composition API), TypeScript 5+
- **Build Tool**: Vite 7+
- **Charts**: ECharts 6.0+ for data visualization
- **State Management**: Pinia 3.0+
- **Styling**: TailwindCSS 4+ with scoped CSS
- **Icons**: Lucide Vue Next
- **Data Processing**: SheetJS for Excel/CSV handling

## Project Structure

```
src/
├── components/
│   ├── charts/          # ECharts components
│   ├── common/          # Reusable UI components
│   ├── layout/          # Layout components
│   └── panels/          # Dashboard panels
├── composables/         # Vue composables
├── stores/             # Pinia stores
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── constants/          # Application constants
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deployment

```bash
# Deploy to GitHub Pages
npm run deploy
```

## Usage

1. **Import Data**: Click the import button in the header to upload Excel/CSV files or connect to Google Sheets
2. **Navigate**: Use the sidebar to switch between different views and charts
3. **Interact**: All charts and maps are fully interactive with zoom, pan, and filter capabilities
4. **Export**: Use the export functionality to save charts and data

## Development Guidelines

This project follows strict development standards:

- Vue 3 Composition API with `<script setup>`
- TypeScript strict mode (no `any` types)
- TailwindCSS for layout, scoped CSS for specific components
- ECharts with proper disposal and performance optimization
- Pinia setup stores for state management

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript interfaces for all data structures
3. Implement proper error handling and loading states
4. Test responsiveness at all breakpoints
5. Dispose of resources properly in `onUnmounted`

## License

MIT License
