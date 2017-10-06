import {
  isMessageResponse,
  MessageResponse,
  toMessageResponse
} from "../MessageResponse";

import { CreatedMessage } from "../CreatedMessage";

import { toMessageBodyMarkdown } from "../MessageBodyMarkdown";

import { MessageContent } from "../MessageContent";

import { toMessageSubject } from "../MessageSubject";

import { toFiscalCode } from "../FiscalCode";

import { NotificationStatus } from "../NotificationStatus";

import { toNotificationChannelStatus } from "../NotificationChannelStatus";

import { toTimeToLive } from "../TimeToLive";

describe("Check MessageResponse methods", () => {
  test("toCreatedMessage", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse: MessageResponse = {
      message: msg,
      notification: ns
    };

    expect(toMessageResponse(messageResponse).get).toEqual(messageResponse);
  });

  test("isMessageResponse", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse: MessageResponse = {
      message: msg,
      notification: ns
    };

    expect(isMessageResponse(messageResponse)).toBe(true);
  });

  test("isMessageResponse, check message property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: toNotificationChannelStatus("SENT_TO_CHANNEL").get
    };

    const messageResponse: MessageResponse = {
      message: msg,
      notification: ns
    };

    expect(isMessageResponse(messageResponse)).toBe(false);
  });

  test("isMessageResponse, check message property", () => {
    const s = toMessageSubject("Lorem ipsum dolor sit amet");
    const m = toMessageBodyMarkdown(
      // String long 90 characters.
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt"
    );

    const messageContent: MessageContent = {
      markdown: m.get,
      subject: s.get
    };

    const msg: CreatedMessage = {
      content: messageContent,
      fiscal_code: toFiscalCode("AAABBB01C01A000A").get,
      id: "12345",
      sender_organization_id: "Sender Organization",
      time_to_live: toTimeToLive(3600).get
    };

    const ns: NotificationStatus = {
      email: "WRONG"
    };

    const messageResponseOne: MessageResponse = {
      message: msg,
      notification: ns
    };
    expect(isMessageResponse(messageResponseOne)).toBe(false);

    const messageResponseTwo: MessageResponse = {
      message: msg,
      notification: undefined
    };
    expect(isMessageResponse(messageResponseTwo)).toBe(true);

    /* tslint:disable */
    const messageResponseThree: MessageResponse = {
      message: msg,
      notification: null
    };
    /* tslint:enable */
    expect(isMessageResponse(messageResponseThree)).toBe(true);
  });
});