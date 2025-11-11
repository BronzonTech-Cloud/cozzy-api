import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import slowDown from 'express-slow-down';
import redoc from 'redoc-express';

import { errorHandler, notFoundHandler } from './middleware/error';
import { router as apiRouter } from './routes';
import { swaggerSpec } from './config/swagger';
import { generalLimiter } from './middleware/rate-limit';
import { performanceMiddleware } from './middleware/performance';
import { env } from './config/env';

export function createApp() {
  const app = express();

  // Trust proxy for accurate IP detection in production/CI
  // In test environment, this helps rate limiting work correctly
  if (env.NODE_ENV === 'production' || env.NODE_ENV === 'test') {
    app.set('trust proxy', true);
  }

  // Configure Helmet with CSP that allows ReDoc
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://unpkg.com',
            'https://fonts.googleapis.com',
          ],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  // CORS configuration - require CLIENT_URL in production
  let corsOrigin: string | string[] | undefined;
  if (env.NODE_ENV === 'production') {
    if (!env.CLIENT_URL) {
      throw new Error('CLIENT_URL must be set in production environment');
    }
    // In production, use explicit origin(s) - support multiple origins if comma-separated
    corsOrigin = env.CLIENT_URL.split(',').map((url) => url.trim());
  } else {
    // Development: allow all origins for easier local development
    corsOrigin = '*';
  }
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));
  app.use(performanceMiddleware);

  // Apply general rate limiting to all API routes except auth routes
  // Auth routes have their own specific rate limiters
  app.use('/api/v1', (req, res, next) => {
    // Skip general limiter for auth routes (they have their own limiters)
    if (req.path.startsWith('/auth')) {
      return next();
    }
    return generalLimiter(req, res, next);
  });

  const authSlowdown = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 10,
    delayMs: () => 200,
  });

  // Serve OpenAPI spec as JSON
  app.get('/api-docs/swagger.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ReDoc for beautiful API documentation
  app.get(
    '/api-docs',
    redoc({
      title: 'Cozzy E-commerce API',
      specUrl: '/api-docs/swagger.json',
      nonce: '', // optional, for CSP
      redocOptions: {
        theme: {
          colors: {
            primary: {
              main: '#6366f1', // Indigo
              light: '#818cf8',
              dark: '#4f46e5',
              contrastText: '#ffffff',
            },
            success: {
              main: '#10b981', // Green
            },
            warning: {
              main: '#f59e0b', // Amber
            },
            error: {
              main: '#ef4444', // Red
            },
            text: {
              primary: '#111827',
              secondary: '#6b7280',
            },
            http: {
              get: '#10b981',
              post: '#3b82f6',
              put: '#f59e0b',
              patch: '#f59e0b',
              delete: '#ef4444',
              basic: '#6b7280',
              link: '#6366f1',
              head: '#8b5cf6',
            },
          },
          typography: {
            fontSize: '15px',
            lineHeight: '1.6',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontWeightRegular: '400',
            fontWeightBold: '600',
            fontWeightLight: '300',
            headings: {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '700',
              lineHeight: '1.2',
            },
            code: {
              fontSize: '13px',
              fontFamily:
                '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
              fontWeight: '400',
              color: '#e11d48',
              backgroundColor: '#fef2f2',
              wrap: false,
            },
            links: {
              color: '#6366f1',
              visited: '#6366f1',
            },
          },
          sidebar: {
            backgroundColor: '#ffffff',
            textColor: '#111827',
            activeTextColor: '#6366f1',
            groupItems: {
              activeBackgroundColor: '#eef2ff',
              activeTextColor: '#6366f1',
              textColor: '#6b7280',
            },
            level1Items: {
              activeBackgroundColor: '#eef2ff',
              activeTextColor: '#6366f1',
              textColor: '#111827',
            },
          },
          rightPanel: {
            backgroundColor: '#1f2937',
            textColor: '#f9fafb',
            servers: {
              overlay: {
                backgroundColor: '#374151',
                textColor: '#f9fafb',
              },
              url: {
                backgroundColor: '#111827',
              },
            },
          },
          schema: {
            linesColor: '#e5e7eb',
            defaultDetailsWidth: '75%',
            typeNameColor: '#6366f1',
            typeTitleColor: '#111827',
            requireLabelColor: '#ef4444',
            labelsTextSize: '13px',
            nestingSpacing: '16px',
            nestedBackground: '#f9fafb',
            arrow: {
              size: '1.1em',
              color: '#6b7280',
            },
          },
          codeBlock: {
            backgroundColor: '#1f2937',
          },
        },
        scrollYOffset: 0,
        hideDownloadButton: false,
        disableSearch: false,
        onlyRequiredInSamples: false,
        hideHostname: false,
        expandResponses: '200,201',
        requiredPropsFirst: true,
        sortOperationsAlphabetically: false,
        sortTagsAlphabetically: true,
        jsonSampleExpandLevel: 3,
        hideSingleRequestSampleTab: false,
        menuToggle: true,
        nativeScrollbars: false,
        pathInMiddlePanel: true,
        hideSchemaPattern: false,
        payloadSampleIdx: 0,
        generatedPayloadSamplesMaxDepth: 10,
        hideFab: false,
        showExtensions: true,
      },
    }),
  );

  app.use('/api/v1/auth', authSlowdown);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
