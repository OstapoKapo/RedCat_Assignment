import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionEntity } from '../entities/transaction.entity';
import { UserRole } from '../../users/entities/user.entity';

type RequestWithAuth = {
  user?: {
    sub?: string;
    role?: UserRole;
  };
  params?: Record<string, string | undefined>;
};

@Injectable()
export class TransactionOwnerOrAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const currentUser = request.user;
    const transactionId = request.params?.transactionId;

    if (!currentUser?.sub || !currentUser.role || !transactionId) {
      return false;
    }

    if (currentUser.role === UserRole.ADMIN) {
      return true;
    }

    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: {
        sender: true,
        receiver: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const isOwner =
      transaction.sender?.id === currentUser.sub ||
      transaction.receiver.id === currentUser.sub;
    if (!isOwner) {
      throw new ForbiddenException('You can cancel only your own transactions');
    }

    return true;
  }
}
