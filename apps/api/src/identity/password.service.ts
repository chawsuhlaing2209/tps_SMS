import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";

/** Characters chosen to avoid ambiguous glyphs in emailed temporary passwords. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  /** Generates a human-readable temporary password suitable for email delivery. */
  generateTemporaryPassword(length = 12): string {
    const bytes = randomBytes(length);
    let password = "";
    for (let index = 0; index < length; index += 1) {
      password += TEMP_PASSWORD_ALPHABET[bytes[index]! % TEMP_PASSWORD_ALPHABET.length];
    }
    return password;
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
