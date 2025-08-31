// src/common/middlewares/request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { RequestContext } from '../request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: () => void) {
    const requestId = (req.headers['x-request-id'] as string) || uuid();
    const auth = (req.headers['authorization'] as string) || ''; // dạng "Bearer xxx"
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    RequestContext.run(
      {
        requestId,
        path: req.originalUrl,
        method: req.method,
        ip,
        authorization: auth,
      },
      () => next(),
    );
  }
}
