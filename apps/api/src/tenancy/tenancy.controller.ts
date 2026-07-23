import { Controller, Get, Headers, Query, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { TenancyService } from "./tenancy.service.js";

@Controller("tenancy")
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get("resolve")
  @UseGuards(ThrottlerGuard)
  @Throttle({ credentials: { limit: 30, ttl: 60_000 } })
  resolve(@Headers("host") host: string | undefined, @Query("tenant") tenantSlug?: string) {
    return {
      tenantSlug: this.tenancyService.resolveSlug({ host, tenantSlug })
    };
  }
}
