import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  JWT_ACCESS_STRATEGY,
} from '../auth/constants/auth.constants';
import { JwtAccessAuthGuard } from '../auth/guards/jwt-access-auth.guard';
import { Roles } from '../shared/decorators/roles.decorator';
import { RolesGuard } from '../shared/guards/roles.guard';
import { SelfOrAdminGuard } from '../shared/guards/self-or-admin.guard';
import { UserRole } from '../users/entities/user.entity';
import { BillingService } from './billing.service';
import { DepositDto } from './dto/deposit.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionOwnerOrAdminGuard } from './guards/transaction-owner-or-admin.guard';

@ApiTags('Billing')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
@ApiBearerAuth(JWT_ACCESS_STRATEGY)
@UseGuards(JwtAccessAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post(':id/deposit')
  @UseGuards(JwtAccessAuthGuard, SelfOrAdminGuard)
  @ApiOperation({
    summary: 'Deposit funds',
    description:
      'Deposits amount to target user balance and creates COMPLETED DEPOSIT transaction.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '5cbe7998-4d61-4b20-8985-f4084b8fa8ee',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: 'Optional idempotency key for safe retries',
    example: 'deposit-req-001',
  })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid amount or idempotency conflict',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'User is not owner and not admin' })
  async deposit(
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() dto: DepositDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.billingService.deposit(
      userId,
      dto.amount,
      this.normalizeIdempotencyKey(idempotencyKey),
    );

    return TransactionResponseDto.fromEntity(transaction);
  }

  @Post(':id/transfer')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @UseGuards(JwtAccessAuthGuard, SelfOrAdminGuard)
  @ApiOperation({
    summary: 'Transfer funds',
    description:
      'Transfers amount from sender user to receiver and creates COMPLETED TRANSFER transaction.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '0c7b4dbf-6bc8-443d-96be-7f14f90b79d3',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: 'Optional idempotency key for safe retries',
    example: 'transfer-req-001',
  })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid amount, balance, receiver, or idempotency conflict',
  })
  @ApiNotFoundResponse({ description: 'Receiver not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'User is not owner and not admin' })
  async transfer(
    @Param('id', new ParseUUIDPipe()) senderId: string,
    @Body() dto: TransferDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.billingService.transfer(
      senderId,
      dto.receiverEmailOrId,
      dto.amount,
      this.normalizeIdempotencyKey(idempotencyKey),
    );

    return TransactionResponseDto.fromEntity(transaction);
  }

  @Post(':id/cancel/:transactionId')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @UseGuards(JwtAccessAuthGuard, SelfOrAdminGuard, TransactionOwnerOrAdminGuard)
  @ApiOperation({
    summary: 'Cancel transaction',
    description:
      'Cancels transaction and performs rollback logic for DEPOSIT/TRANSFER.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '5cbe7998-4d61-4b20-8985-f4084b8fa8ee',
  })
  @ApiParam({
    name: 'transactionId',
    format: 'uuid',
    example: 'f4b5a8e8-d44c-4f21-a2c3-09f6d35795ae',
  })
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: 'Optional idempotency key for safe retries',
    example: 'cancel-req-001',
  })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Transaction cannot be cancelled or idempotency conflict',
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'User is not owner and not admin' })
  async cancel(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.billingService.cancel(
      transactionId,
      this.normalizeIdempotencyKey(idempotencyKey),
    );

    return TransactionResponseDto.fromEntity(transaction);
  }

  @Get(':id/transactions')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @UseGuards(JwtAccessAuthGuard, SelfOrAdminGuard)
  @ApiOperation({
    summary: 'Get user transactions',
    description: 'Returns transactions where user is sender or receiver.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: '5cbe7998-4d61-4b20-8985-f4084b8fa8ee',
  })
  @ApiOkResponse({ type: TransactionResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'User is not owner and not admin' })
  async getUserTransactions(
    @Param('id', new ParseUUIDPipe()) userId: string,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.billingService.getTransactions(
      userId,
      false,
    );
    return transactions.map((item) => TransactionResponseDto.fromEntity(item));
  }

  @Get('transactions')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAccessAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Get all transactions (admin)',
    description: 'Returns all transactions in the system.',
  })
  @ApiOkResponse({ type: TransactionResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async getAllTransactions(): Promise<TransactionResponseDto[]> {
    const transactions = await this.billingService.getTransactions('', true);
    return transactions.map((item) => TransactionResponseDto.fromEntity(item));
  }

  private normalizeIdempotencyKey(key: string | undefined): string | undefined {
    const normalized = key?.trim();
    return normalized ? normalized : undefined;
  }
}
