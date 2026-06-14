import { Controller, Get } from "@nestjs/common";
import { mvpBacklog, productDecisionDefaults, productModules } from "@sms/shared";

@Controller()
export class AppController {
  @Get("health")
  health() {
    return {
      status: "ok",
      service: "sms-api"
    };
  }

  @Get("foundation")
  foundation() {
    return {
      modules: productModules,
      backlog: mvpBacklog,
      productDecisionDefaults
    };
  }
}
