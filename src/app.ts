import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import redoc from 'redoc-express';

import { errorHandler, notFoundHandler } from './middleware/error';
import { router as apiRouter } from './routes';
import { swaggerSpec } from './config/swagger';

export function createApp() {
  const app = express();

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
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
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
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontWeightRegular: '400',
            fontWeightBold: '600',
            fontWeightLight: '300',
            headings: {
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '700',
              lineHeight: '1.2',
            },
            code: {
              fontSize: '13px',
              fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", "Courier New", monospace',
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

  app.use('/api/v1/auth', authLimiter, authSlowdown);
  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
