import { Controller, Get, Headers, Query } from "@nestjs/common";
import { TenancyService } from "./tenancy.service.js";

@Controller("tenancy")
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Get("resolve")
  resolve(@Headers("host") host: string | undefined, @Query("tenant") tenantSlug?: string) {
    return {
      tenantSlug: this.tenancyService.resolveSlug({ host, tenantSlug })
    };
  }
}
