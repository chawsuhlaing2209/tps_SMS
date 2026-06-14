import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@sms/shared";

export const PERMISSIONS_KEY = "required_permissions";
export const PERMISSIONS_MODE_KEY = "permissions_mode";

export type PermissionsMode = "all" | "any";

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Passes when the actor holds at least one of the listed permissions. */
export const RequireAnyPermissions = (...permissions: Permission[]) => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    SetMetadata(PERMISSIONS_KEY, permissions)(target, key!, descriptor!);
    SetMetadata(PERMISSIONS_MODE_KEY, "any" satisfies PermissionsMode)(target, key!, descriptor!);
  };
};
