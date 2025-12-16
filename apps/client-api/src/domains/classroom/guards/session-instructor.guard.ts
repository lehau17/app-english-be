import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaRepository } from '@app/database';

/**
 * Guard to verify that the current user is the instructor of the session
 * Used for teacher-only operations on sessions they own
 */
@Injectable()
export class SessionInstructorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.params.sessionId;
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!sessionId) {
      throw new ForbiddenException('Session ID not provided');
    }

    // Find session and check instructor
    const session = await this.prisma.classroomSession.findUnique({
      where: { id: sessionId },
      select: { instructorId: true, id: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.instructorId !== userId) {
      throw new ForbiddenException(
        'Only the session instructor can perform this action',
      );
    }

    return true;
  }
}
