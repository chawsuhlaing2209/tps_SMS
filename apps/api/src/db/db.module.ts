import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export const DB = Symbol("DB");

export type Database = ReturnType<typeof drizzle<typeof schema>>;

@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pool = new Pool({
          connectionString: configService.getOrThrow<string>("DATABASE_URL")
        });

        return drizzle(pool, { schema });
      }
    }
  ],
  exports: [DB]
})
export class DbModule {}
