import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import {
  tenantDbContextStorage,
  tenantIdFromPath
} from "./db/tenant-db-context.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Every request gets a tenant DB context (RLS backstop, DEPLOYMENT.md I4):
  // pre-filled from UUID tenant paths; slug paths are stamped later by
  // AuthService.resolveTenantId; PlatformAdminGuard enables the bypass.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    tenantDbContextStorage.run({ tenantId: tenantIdFromPath(req.path) }, next);
  });
  // API serves JSON only; a strict CSP is safe and blocks framing/sniffing abuse.
  app.use(helmet());
  app.disable("x-powered-by");
  app.enableCors({
    origin: process.env.API_ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:3000"],
    credentials: true
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Swagger publishes the full API surface — dev/staging convenience only,
  // never reachable in production (DEPLOYMENT.md §5).
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("School Management System API")
      .setDescription("Tenant-safe API foundation for the Myanmar school management SaaS.")
      .setVersion("0.1.0")
      .build();
    SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(Number(process.env.API_PORT ?? 4000));
}

void bootstrap();
