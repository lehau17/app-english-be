// common/decorators/payload-token.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../payload';
import { RequestContext } from '../request-context';

export const PayloadToken = createParamDecorator<
  string | undefined,
  ExecutionContext,
  JwtPayload | string | number | undefined
>((field: string | undefined, ctx: ExecutionContext) => {
  const user = RequestContext.getValue('user') || ctx.switchToHttp().getRequest().user;

  if (!user) {
    return undefined;
  }

  // Nếu có field name, trả về giá trị của field đó
  if (field) {
    return (user as JwtPayload)[field as keyof JwtPayload] as string | number | undefined;
  }

  // Nếu không có field name, trả về toàn bộ payload (backward compatible)
  return user as JwtPayload;
});
