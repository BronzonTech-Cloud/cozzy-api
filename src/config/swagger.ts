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
            emailVerified: {
              type: 'boolean',
              description: 'Whether the user has verified their email',
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
            trackingNumber: {
              type: 'string',
              nullable: true,
              description: 'Shipping tracking number',
            },
            shippedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Date when order was shipped',
            },
            deliveredAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Date when order was delivered',
            },
            statusHistory: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/OrderStatusHistory',
              },
              description: 'Order status change history',
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
        Cart: {
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
            items: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CartItem',
              },
            },
            totalCents: {
              type: 'integer',
              description: 'Total price in cents',
            },
            itemsCount: {
              type: 'integer',
              description: 'Total number of items in cart',
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
        CartItem: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            cartId: {
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
              description: 'Quantity of the product in cart',
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
        Review: {
          type: 'object',
          properties: {
            id: {
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
            userId: {
              type: 'string',
              format: 'uuid',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Rating from 1 to 5 stars',
            },
            title: {
              type: 'string',
              nullable: true,
              description: 'Review title',
            },
            comment: {
              type: 'string',
              nullable: true,
              description: 'Review comment',
            },
            verified: {
              type: 'boolean',
              description: 'Whether the reviewer has purchased the product',
            },
            helpful: {
              type: 'integer',
              default: 0,
              description: 'Number of helpful votes',
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
        Wishlist: {
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
            productId: {
              type: 'string',
              format: 'uuid',
            },
            product: {
              $ref: '#/components/schemas/Product',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Address: {
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
            label: {
              type: 'string',
              description: 'Address label (e.g., "Home", "Work")',
            },
            firstName: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
            street: {
              type: 'string',
            },
            city: {
              type: 'string',
            },
            state: {
              type: 'string',
              nullable: true,
            },
            zipCode: {
              type: 'string',
            },
            country: {
              type: 'string',
              default: 'US',
            },
            phone: {
              type: 'string',
              nullable: true,
            },
            isDefault: {
              type: 'boolean',
              default: false,
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
        AddressInput: {
          type: 'object',
          required: ['label', 'firstName', 'lastName', 'street', 'city', 'zipCode'],
          properties: {
            label: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
            },
            firstName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
            lastName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
            street: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
            },
            city: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
            state: {
              type: 'string',
              maxLength: 100,
            },
            zipCode: {
              type: 'string',
              minLength: 1,
              maxLength: 20,
            },
            country: {
              type: 'string',
              minLength: 2,
              maxLength: 2,
              default: 'US',
            },
            phone: {
              type: 'string',
              maxLength: 20,
            },
            isDefault: {
              type: 'boolean',
              default: false,
            },
          },
        },
        OrderStatusHistory: {
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
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'CANCELLED', 'FULFILLED', 'REFUNDED'],
            },
            note: {
              type: 'string',
              nullable: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ProductVariant: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            productId: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              description: 'Variant name (e.g., "Size: Large", "Color: Red")',
            },
            sku: {
              type: 'string',
              nullable: true,
              description: 'Stock Keeping Unit',
            },
            priceCents: {
              type: 'integer',
              nullable: true,
              description: 'Override product price (in cents)',
            },
            stock: {
              type: 'integer',
              default: 0,
              description: 'Stock quantity for this variant',
            },
            images: {
              type: 'array',
              items: { type: 'string', format: 'url' },
              description: 'Variant-specific images',
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
        ProductVariantInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 200,
            },
            sku: {
              type: 'string',
              maxLength: 100,
            },
            priceCents: {
              type: 'integer',
              minimum: 1,
              description: 'Override product price (in cents)',
            },
            stock: {
              type: 'integer',
              minimum: 0,
              default: 0,
            },
            images: {
              type: 'array',
              items: { type: 'string', format: 'url' },
              default: [],
            },
          },
        },
        Coupon: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            code: {
              type: 'string',
              description: 'Unique coupon code',
            },
            description: {
              type: 'string',
              nullable: true,
            },
            discountType: {
              type: 'string',
              enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
            },
            discountValue: {
              type: 'integer',
              description: 'Percentage (1-100) or amount in cents',
            },
            minPurchase: {
              type: 'integer',
              nullable: true,
              description: 'Minimum purchase amount in cents',
            },
            maxDiscount: {
              type: 'integer',
              nullable: true,
              description: 'Maximum discount amount in cents (for percentage discounts)',
            },
            usageLimit: {
              type: 'integer',
              nullable: true,
              description: 'Total usage limit',
            },
            usageCount: {
              type: 'integer',
              default: 0,
              description: 'Current usage count',
            },
            validFrom: {
              type: 'string',
              format: 'date-time',
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
            },
            active: {
              type: 'boolean',
              default: true,
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
        CouponInput: {
          type: 'object',
          required: ['code', 'discountType', 'discountValue', 'validFrom', 'validUntil'],
          properties: {
            code: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
            },
            description: {
              type: 'string',
              maxLength: 500,
            },
            discountType: {
              type: 'string',
              enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
            },
            discountValue: {
              type: 'integer',
              minimum: 1,
            },
            minPurchase: {
              type: 'integer',
              minimum: 1,
            },
            maxDiscount: {
              type: 'integer',
              minimum: 1,
            },
            usageLimit: {
              type: 'integer',
              minimum: 1,
            },
            validFrom: {
              type: 'string',
              format: 'date-time',
            },
            validUntil: {
              type: 'string',
              format: 'date-time',
            },
            active: {
              type: 'boolean',
              default: true,
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
      {
        name: 'Cart',
        description: 'Shopping cart management',
      },
      {
        name: 'Reviews',
        description: 'Product reviews and ratings',
      },
      {
        name: 'Wishlist',
        description: 'Wishlist/favorites management',
      },
      {
        name: 'Profile',
        description: 'User profile and address management',
      },
      {
        name: 'Coupons',
        description: 'Coupon and discount code management',
      },
      {
        name: 'Search',
        description: 'Product search and suggestions',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
