import { Router } from 'express';
import type { Dish } from '@sufra/contracts';
import { menu } from './catalog-data.js';

// Public module boundary. Consumers never import catalog-data directly.
export interface CatalogReader { list(): Dish[] }
export function createCatalog(): CatalogReader {
  return { list: () => structuredClone(menu) };
}
export function createCatalogRouter(catalog: CatalogReader): Router {
  const router = Router();
  router.get('/', (_req, res) => res.json({ dishes: catalog.list(), currency: 'JOD' }));
  return router;
}
