import { randomBytes } from "node:crypto";
import { MessagingAdapter, MessagingInput } from "../../domain/interfaces.js";
import { MessageDispatchResult } from "../../domain/types.js";

export class MockMessagingAdapter implements MessagingAdapter {
  async sendLink(input: MessagingInput): Promise<MessageDispatchResult> {
    // TODO: Replace this mock flow with real messaging integration.
    const failHint = input.recipientValue.toLowerCase();

    if (failHint.includes("fail")) {
      return {
        status: "failed",
        messageId: randomBytes(8).toString("hex")
      };
    }

    return {
      status: "queued",
      messageId: randomBytes(8).toString("hex")
    };
  }
}
