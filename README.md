# RAMSspace - Enterprise RAMS Tool

A comprehensive Reliability, Availability, Maintainability, and Safety (RAMS) analysis platform built with React and TypeScript.

## Version 2.0.0

### Features

- **RBD (Reliability Block Diagram)** - Analyze system reliability architecture
- **FTA (Fault Tree Analysis)** - Identify failure modes and root causes
- **RAM Analysis** - Comprehensive reliability and maintainability assessment
- **LCC (Life Cycle Cost)** - Analyze total cost of ownership
- **FMECA** - Failure Mode, Effects, and Criticality Analysis
- **Monitoring & Reporting** - Track and visualize RAMS metrics
- **Components Database** - Manage component libraries and specifications

### Tech Stack

- **Frontend**: React 18.3, TypeScript 5.5
- **Build Tool**: esbuild
- **UI Library**: Lucide React Icons, Recharts
- **State Management**: React Context API
- **Routing**: React Router v6

### Project Structure

```
RAMSspace/
├── frontend/
│   ├── src/
│   │   ├── components/        # Shared UI components
│   │   ├── modules/           # Feature modules
│   │   ├── utils/             # Utility functions
│   │   ├── styles/            # CSS stylesheets
│   │   ├── App.tsx            # Main app component
│   │   └── index.tsx          # Entry point
│   ├── public/                # Static assets
│   ├── esbuild.config.js      # Build configuration
│   └── package.json           # Dependencies
├── backend/                   # Backend services (future)
├── python-calc/              # Python calculation modules
├── vercel.json               # Vercel deployment config
└── README.md                 # This file
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/strangerx003/RAMspace.git
cd RAMspace/frontend
```

2. Install dependencies
```bash
npm install
```

3. Start development server
```bash
npm run dev
```

4. Build for production
```bash
npm run build
```

### Deployment

#### Vercel Deployment

This project is configured for deployment on Vercel. Follow these steps:

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the `vercel.json` configuration
3. The build and deployment will be handled automatically

**Automatic Deployment:**
- Commits to `master` branch will trigger automatic deployments
- Pull requests will generate preview deployments

**Environment Variables:**
Copy `.env.example` to `.env.production.local` and configure as needed:
```bash
REACT_APP_API_URL=<your-api-url>
NODE_ENV=production
```

#### Manual Build

```bash
cd frontend
npm run build
```

Output will be in `frontend/public/`

### Scripts

- `npm run dev` - Start development server with watch mode
- `npm run build` - Build for production
- `npm start` - Serve the built application locally

### Performance Optimization

- Minified production builds with source maps for debugging
- Timestamped bundle files for cache busting
- Optimized asset caching headers via Vercel

### Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

### Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and test thoroughly
3. Commit with meaningful messages
4. Push and create a Pull Request

### Version History

- **v2.0.0** - Major update with enhanced modules and utilities
- **v1.0.1** - Initial release

### License

Proprietary - Enterprise RAMS Tool

### Support

For issues and questions, please contact the development team.

---

**Last Updated:** July 1, 2026
