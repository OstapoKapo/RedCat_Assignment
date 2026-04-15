import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

type RequestWithAuth = {
  user?: {
    id?: string;
    sub?: string;
    role?: UserRole;
  };
  params?: Record<string, string | undefined>;
};

@Injectable()
export class SelfOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const currentUser = request.user;
    const requestedUserId = request.params?.id;

    if (!currentUser || !requestedUserId) {
      return false;
    }

    if (currentUser.role === UserRole.ADMIN) {
      return true;
    }

    const currentUserId = currentUser.id ?? currentUser.sub;
    return currentUserId === requestedUserId;
  }
}
