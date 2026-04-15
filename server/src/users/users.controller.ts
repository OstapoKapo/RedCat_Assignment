import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { GetUserResponseDto } from './dto/get-user-response.dto';
import { GetUsersPageResponseDto } from './dto/get-users-page-response.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersPaginationQueryDto } from './dto/users-pagination-query.dto';
import { UsersService } from './users.service';
// roles guard + self-rules
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create user',
    description: 'Creates a new user record in the database.',
  })
  @ApiCreatedResponse({
    description: 'User created',
    type: GetUserResponseDto,
  })
  @ApiConflictResponse({
    description: 'User with this email already exists',
  })
  async createUser(@Body() dto: CreateUserDto): Promise<GetUserResponseDto> {
    const user = await this.usersService.createUser(dto);
    return GetUserResponseDto.fromEntity(user);
  }

  @Get()
  @ApiOperation({
    summary: 'Get users page',
    description: 'Returns users with pagination.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Users page',
    type: GetUsersPageResponseDto,
  })
  async getUsersPage(
    @Query() query: UsersPaginationQueryDto,
  ): Promise<GetUsersPageResponseDto> {
    const result = await this.usersService.listUsersPaginated(
      query.page,
      query.limit,
    );

    return {
      ...result,
      items: result.items.map((item) => GetUserResponseDto.fromEntity(item)),
    };
  }

  @Get('by-email/:email')
  @ApiOperation({
    summary: 'Get user by email',
    description: 'Returns a single user by email.',
  })
  @ApiParam({ name: 'email', example: 'client@example.com' })
  @ApiOkResponse({
    description: 'User found',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async getUserByEmail(
    @Param('email') email: string,
  ): Promise<GetUserResponseDto> {
    const user = await this.usersService.getUserByEmail(email);
    return GetUserResponseDto.fromEntity(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by id',
    description: 'Returns a single user by id.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User found',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async getUserById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetUserResponseDto> {
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Updates user profile fields except role, password, and active status.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User updated',
    type: GetUserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid payload or restricted fields were provided in update body',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<GetUserResponseDto> {
    await this.usersService.updateUser(id, dto);
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Patch(':id/role')
  @ApiOperation({
    summary: 'Update user role',
    description: 'Updates user role.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User role updated',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async updateUserRole(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<GetUserResponseDto> {
    await this.usersService.updateUserRole(id, dto);
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Patch(':id/password')
  @ApiOperation({
    summary: 'Update user password',
    description: 'Updates user password.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User password updated',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async updatePassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserPasswordDto,
  ): Promise<GetUserResponseDto> {
    await this.usersService.updatePassword(id, dto);
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate user',
    description: 'Marks user as inactive.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User deactivated',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async deactivateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetUserResponseDto> {
    await this.usersService.deactivateUser(id);
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Activate user',
    description: 'Marks user as active.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiOkResponse({
    description: 'User activated',
    type: GetUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async activateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<GetUserResponseDto> {
    await this.usersService.activateUser(id);
    const user = await this.usersService.getUserById(id);
    return GetUserResponseDto.fromEntity(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes user from database.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    example: 'e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  @ApiNoContentResponse({
    description: 'User deleted',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async deleteUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.usersService.deleteUser(id);
  }
}
