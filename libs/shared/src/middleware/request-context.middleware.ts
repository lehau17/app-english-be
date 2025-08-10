// request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        const context = {
            requestId: randomUUID(),
            path: req.path,
            method: req.method,
            ip: req.ip,
        };

        RequestContext.run(context, () => {
            next();
        });
    }
}
