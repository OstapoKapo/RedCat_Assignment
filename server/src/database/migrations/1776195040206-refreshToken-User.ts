import { MigrationInterface, QueryRunner } from "typeorm";

export class RefreshTokenUser1776195040206 implements MigrationInterface {
    name = 'RefreshTokenUser1776195040206'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshToken"`);
    }

}
