import { createHash, randomBytes } from "node:crypto";

export const generatePhoneToken = (): string => randomBytes(24).toString("hex");

export const hashPhoneToken = (token: string): string => createHash("sha256").update(token).digest("hex");

