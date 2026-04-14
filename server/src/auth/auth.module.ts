import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthJwtService } from './auth-jwt.service';
import { AuthService } from './auth.service';
import { JWT_ACCESS_STRATEGY } from './constants/auth.constants';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({
      defaultStrategy: JWT_ACCESS_STRATEGY,
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresInSeconds = Number(
          configService.get<string>('JWT_ACCESS_EXPIRES_IN_SECONDS', '900'),
        );

        return {
          secret: configService.get<string>(
            'JWT_ACCESS_SECRET',
            'dev-access-secret',
          ),
          signOptions: {
            expiresIn: Number.isFinite(expiresInSeconds)
              ? expiresInSeconds
              : 900,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthJwtService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService, AuthJwtService, JwtModule, PassportModule],
})
export class AuthModule {}
