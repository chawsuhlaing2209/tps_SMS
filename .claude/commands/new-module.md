# /new-module — Scaffold a New Domain Module

Creates the backend NestJS module + paired frontend route for a new domain.

## Usage
Replace `{module}` with the domain name (e.g. `students`, `finance`, `hr`).

## Backend scaffold

Create these files in `apps/api/src/{module}/`:

### `{module}.module.ts`
```typescript
import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { AuditModule } from '../audit/audit.module'
import { AuthzModule } from '../identity/authz.module'
import { {Module}Controller } from './{module}.controller'
import { {Module}Service } from './{module}.service'

@Module({
  imports: [DbModule, AuditModule, AuthzModule],
  controllers: [{Module}Controller],
  providers: [{Module}Service],
  exports: [{Module}Service],
})
export class {Module}Module {}
```

### `{module}.controller.ts`
```typescript
import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PermissionsGuard } from '../identity/permissions.guard'
import { RequirePermissions } from '../identity/permissions.decorator'
import { {Module}Service } from './{module}.service'
import { Create{Entity}Dto } from './dto'

@ApiTags('{module}')
@Controller('tenants/:tenantId/{module}')
@UseGuards(PermissionsGuard)
export class {Module}Controller {
  constructor(private readonly {module}Service: {Module}Service) {}

  @Get()
  @RequirePermissions('{module}.manage')
  list(@Param('tenantId') tenantId: string) {
    return this.{module}Service.list(tenantId)
  }

  @Post()
  @RequirePermissions('{module}.manage')
  create(@Param('tenantId') tenantId: string, @Body() dto: Create{Entity}Dto) {
    return this.{module}Service.create(tenantId, dto)
  }
}
```

### `{module}.service.ts`
```typescript
import { Injectable } from '@nestjs/common'
import { InjectDb } from '../db/db.module'
import { DrizzleDb } from '../db/schema'
import { AuditService } from '../audit/audit.service'
import { eq } from 'drizzle-orm'
import { {table} } from '../db/schema'

@Injectable()
export class {Module}Service {
  constructor(
    @InjectDb() private readonly db: DrizzleDb,
    private readonly auditService: AuditService,
  ) {}

  async list(tenantId: string) {
    return this.db.select().from({table}).where(eq({table}.tenantId, tenantId))
  }
}
```

### `dto.ts`
```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator'

export class Create{Entity}Dto {
  @IsString()
  @IsNotEmpty()
  name: string
}
```

## Wire into AppModule

In `apps/api/src/app.module.ts`, add:
```typescript
import { {Module}Module } from './{module}/{module}.module'
// Add to imports array:
{Module}Module,
```

## Frontend scaffold

Create `apps/web/app/dashboard/{module}/page.tsx`:
```typescript
'use client'
import { useApiQuery } from '../../lib/api'
import { DataTable } from '../../../components/shared/data-table'
import { PageHeader } from '../../../components/layout/page-header'

export default function {Module}Page() {
  const { data = [], isLoading } = useApiQuery(tid => `/tenants/${tid}/{module}`)
  // ...
}
```

Add to sidebar navigation in `apps/web/components/layout/sidebar.tsx`.
Add i18n keys to `messages/en.json` and `messages/my.json`.
