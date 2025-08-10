import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorator';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const res = ctx.getResponse();

        // Lấy message từ metadata, nếu không có thì mặc định là "OK"
        const message =
            this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler()) ||
            'OK';

        return next.handle().pipe(
            map((data) => ({
                statusCode: res.statusCode || 200,
                message,
                data,
            })),
        );
    }
}
