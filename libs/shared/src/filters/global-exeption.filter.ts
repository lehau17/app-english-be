import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let errors: any = null;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const response = exception.getResponse();
            if (typeof response === 'string') {
                message = response;
            } else if (typeof response === 'object') {
                message = (response as any).message || message;
                errors = (response as any).errors || null;
            }
        }

        res.status(status).json({
            statusCode: status,
            message,
            errors,
            path: req.url,
            timestamp: new Date().toISOString(),
        });
    }
}
