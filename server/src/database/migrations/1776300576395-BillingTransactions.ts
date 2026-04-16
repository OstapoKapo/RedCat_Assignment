import { MigrationInterface, QueryRunner } from "typeorm";

export class BillingTransactions1776300576395 implements MigrationInterface {
    name = 'BillingTransactions1776300576395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_f3f4df269ad96453ec106e9688d"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_5f7d4cc96f61e5b3f7f9e1f2f6f"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "idempotencyKey" character varying`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "UQ_86238dd0ae2d79be941104a5842" UNIQUE ("idempotencyKey")`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_3ba3c7d2c3c63436e2ccceef807" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_8558e098d5c2244d1092ea0c9a6" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_8558e098d5c2244d1092ea0c9a6"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_3ba3c7d2c3c63436e2ccceef807"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "UQ_86238dd0ae2d79be941104a5842"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "idempotencyKey"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_5f7d4cc96f61e5b3f7f9e1f2f6f" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_f3f4df269ad96453ec106e9688d" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
