import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensResponseDto {
  @ApiProperty({
    example: 'mock-access-token-e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  accessToken!: string;

  @ApiProperty({
    example: 'mock-refresh-token-e1c44752-151a-4cc8-a5d7-2bb9a4a65cc4',
  })
  refreshToken!: string;
}
