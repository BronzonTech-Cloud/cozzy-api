import { Request, Response } from 'express';

import { prisma } from '../../config/prisma';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json({ categories });
}

export async function getCategoryBySlug(req: Request, res: Response) {
  const { slug } = req.params as { slug: string };
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return res.status(404).json({ message: 'Category not found' });
  res.json({ category });
}

export async function createCategory(req: Request, res: Response) {
  const { name } = req.body as { name: string };
  const slug = slugify(name);
  const existing = await prisma.category.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) return res.status(409).json({ message: 'Category already exists' });
  const category = await prisma.category.create({ data: { name, slug } });
  res.status(201).json({ category });
}

export async function updateCategory(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  const { name } = req.body as { name?: string };
  const data: { name?: string; slug?: string } = {};
  if (name) {
    data.name = name;
    data.slug = slugify(name);
  }
  try {
    const category = await prisma.category.update({ where: { id }, data });
    res.json({ category });
  } catch {
    res.status(404).json({ message: 'Category not found' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  try {
    await prisma.category.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ message: 'Category not found' });
  }
}
