import { ValidationErrorPayload } from "../utils/validate.js";

export class HttpError extends Error {
  readonly statusCode: number;
  readonly payload?: ValidationErrorPayload;

  constructor(statusCode: number, message: string, payload?: ValidationErrorPayload) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.payload = payload;
  }
}
