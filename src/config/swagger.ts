import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cozzy E-commerce REST API',
      version: '1.0.0',
      description:
        'A production-ready, full-featured RESTful E-commerce API built with TypeScript, Express, PostgreSQL, and Stripe integration.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/BronzonTech-Cloud/cozzy-api',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: env.APP_URL || 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Validation errors',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            name: {
              type: 'string',
            },
            role: {
              type: 'string',
              enum: ['USER', 'ADMIN'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
            },
            slug: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            title: {
              type: 'string',
            },
            slug: {
              type: 'string',
            },
            description: {
              type: 'string',
            },
            priceCents: {
              type: 'integer',
              description: 'Price in cents',
            },
            currency: {
              type: 'string',
              default: 'USD',
            },
            sku: {
              type: 'string',
              nullable: true,
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
            },
            active: {
              type: 'boolean',
            },
            stock: {
              type: 'integer',
            },
            categoryId: {
              type: 'string',
              format: 'uuid',
            },
            category: {
              $ref: '#/components/schemas/Category',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'CANCELLED', 'FULFILLED', 'REFUNDED'],
            },
            totalCents: {
              type: 'integer',
            },
            currency: {
              type: 'string',
            },
            itemsCount: {
              type: 'integer',
            },
            paymentProvider: {
              type: 'string',
            },
            paymentIntentId: {
              type: 'string',
              nullable: true,
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderItem',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            orderId: {
              type: 'string',
              format: 'uuid',
            },
            productId: {
              type: 'string',
              format: 'uuid',
            },
            product: {
              $ref: '#/components/schemas/Product',
            },
            quantity: {
              type: 'integer',
            },
            unitPriceCents: {
              type: 'integer',
            },
            subtotalCents: {
              type: 'integer',
            },
          },
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoint',
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Users',
        description: 'User management (Admin only)',
      },
      {
        name: 'Categories',
        description: 'Product category management',
      },
      {
        name: 'Products',
        description: 'Product management',
      },
      {
        name: 'Orders',
        description: 'Order management',
      },
      {
        name: 'Payments',
        description: 'Payment processing with Stripe',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

