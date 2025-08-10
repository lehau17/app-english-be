// common/decorators/payload-token.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../payload';
import { RequestContext } from '../request-context';

export const PayloadToken = createParamDecorator<unknown, ExecutionContext, JwtPayload>(
    (_: unknown, ctx: ExecutionContext) => {
        const user = RequestContext.getValue('user');
        if (user) return user;

        // Fallback: lấy từ request (trường hợp chưa set vào RequestContext)
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);
