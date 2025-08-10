import { RequestContext, TokenRepository } from '@app/shared';
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AccessTokenGuard implements CanActivate {
    constructor(
        private readonly tokenRepository: TokenRepository,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();
        const path = req.path || '';
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1] || null;

        // helper: verify + set req.user + set RequestContext.user
        const attachUserFromToken = (jwt: string) => {
            try {
                const payload = this.tokenRepository.decodeToken(jwt);
                req.user = payload;
                RequestContext.set('user', payload);
                RequestContext.set('path', path);
                RequestContext.set('method', req.method);
                return payload;
            } catch {
                throw new UnauthorizedException('Invalid token');
            }
        };

        // /api/public -> cho qua nếu không có token; nếu có thì vẫn set context
        if (path.startsWith('/api/public')) {
            if (!token) return true;
            attachUserFromToken(token);
            return true;
        }

        // /api/private -> bắt buộc token
        if (path.startsWith('/api/private')) {
            if (!token) throw new UnauthorizedException('Missing access token');
            attachUserFromToken(token);
            return true;
        }

        // /api/admin -> bắt buộc token + role admin
        if (path.startsWith('/api/admin')) {
            if (!token) throw new UnauthorizedException('Missing access token');
            const payload = attachUserFromToken(token);
            if (!payload.role.includes('admin')) {
                throw new ForbiddenException('Admin role required');
            }
            return true;
        }

        // default: chặn
        return false;
    }
}
