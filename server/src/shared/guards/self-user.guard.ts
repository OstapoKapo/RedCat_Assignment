import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../auth/types/jwt-payload.type';

type RequestWithUserAndParams = {
  user?: JwtPayload;
  params?: Record<string, string | undefined>;
};

@Injectable()
export class SelfUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUserAndParams>();
    const currentUserId = request.user?.sub;
    const requestedUserId = request.params?.id;

    return Boolean(
      currentUserId && requestedUserId && currentUserId === requestedUserId,
    );
  }
}
