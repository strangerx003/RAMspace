# RAMSspace v2.0

**RAMS Analysis Tool** for Reliability, Availability, Maintainability, and Safety calculations.

## Features

- **Components Database**: Manage reliability components with failure rates, MTBF, MTTR, and distribution types
- **Reliability Block Diagrams (RBD)**: Interactive SVG-based diagram editor with drag-and-drop blocks, 8-port connections, and k-out-of-n redundancy support
- **Fault Tree Analysis (FTA)**: Top-down failure analysis with AND/OR/XOR gates and probability calculation
- **RAM Analysis**: Automated reliability/availability/maintainability analysis using RBD structure
- **Real-time Calculations**: Live results panel showing λs, MTBFs, MTTRs, and Availability

## Quick Start

```bash
# Install dependencies
cd frontend
npm install

# Development mode
npm run dev

# Production build
npm run build

# Start server
npm start
```

Then open http://localhost:3000

## Standards

- EN 50126 (Railway RAMS)
- IEC 61078 (Reliability Block Diagrams)

## Tech Stack

- React 18 + TypeScript
- esbuild bundler
- localStorage persistence

## Version 2.0 Changes

- Added k-out-of-n active redundancy calculations
- Parallel topology detection from RBD connections
- Corrected availability formulas matching industry standards
- Unique bundle filenames to prevent caching issues

## License

MIT