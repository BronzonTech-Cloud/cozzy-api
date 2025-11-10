import { Router } from 'express';

import { getSearchSuggestions } from '../products/search.controller';

export const searchRouter = Router();

/**
 * @swagger
 * /api/v1/search/suggestions:
 *   get:
 *     summary: Get search suggestions/autocomplete
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *     responses:
 *       200:
 *         description: Search suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       image: { type: string, format: url, nullable: true }
 *       400:
 *         description: Query too short (minimum 2 characters)
 */
searchRouter.get('/suggestions', getSearchSuggestions);
