import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

type Validator = {
  body?: ZodSchema<unknown>;
  query?: ZodSchema<unknown>;
  params?: ZodSchema<unknown>;
};

export function validate(schemas: Validator) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) schemas.body.parse(req.body);
      if (schemas.query) schemas.query.parse(req.query);
      if (schemas.params) schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(err);
    }
  };
}
