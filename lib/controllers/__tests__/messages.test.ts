// tslint:disable:no-any

import { response as MockResponse } from "jest-mock-express";

import { options, some, none } from "ts-option";
import { left, right } from "../../utils/either";

import { ModelId } from "../../utils/documentdb_model_versioned";

import { toFiscalCode } from "../../utils/fiscalcode";
import { IAzureApiAuthorization, UserGroup } from "../../utils/middlewares/azure_api_auth";
import { IAzureUserAttributes } from "../../utils/middlewares/azure_user_attributes";

import { INewMessage, IPublicExtendedMessage, IRetrievedMessage } from "../../models/message";
import { CreateMessageHandler, GetMessageHandler, IMessagePayload } from "../messages";

const aFiscalCode = toFiscalCode("FRLFRC74E04B157I").get;

const someUserAttributes: IAzureUserAttributes = {
  kind: "IAzureUserAttributes",
  organization: {
    name: "AgID",
    organizationId: "agid" as ModelId,
  },
};

const aUserAuthenticationDeveloper: IAzureApiAuthorization = {
  groups: new Set([UserGroup.Developers]),
  kind: "IAzureApiAuthorization",
};

const aUserAuthenticationTrustedApplication: IAzureApiAuthorization = {
  groups: new Set([UserGroup.TrustedApplications]),
  kind: "IAzureApiAuthorization",
};

const aMessagePayload: IMessagePayload = {
  body_short: "Hello, world!",
  dry_run: false,
};

const aNewMessage: INewMessage = {
  bodyShort: "some text",
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID",
  kind: "INewMessage",
  senderOrganizationId: "agid" as ModelId,
};

const aRetrievedMessage: IRetrievedMessage = {
  ...aNewMessage,
  _self: "xyz",
  _ts: "xyz",
  kind: "IRetrievedMessage",
};

const aPublicExtendedMessage: IPublicExtendedMessage = {
  bodyShort: aNewMessage.bodyShort,
  fiscalCode: aNewMessage.fiscalCode,
  kind: "IPublicExtendedMessage",
  senderOrganizationId: aNewMessage.senderOrganizationId,
};

describe("CreateMessageHandler", () => {

  it("should require the user to be part of an organization", async () => {
    const createMessageHandler = CreateMessageHandler({} as any);
    const result = await createMessageHandler({} as any, {} as any, {
      organization: undefined,
    } as any, {} as any, {} as any);

    expect(result.kind).toBe("IResponseErrorValidation");
  });

  it("should allow dry run calls", async () => {
    const mockMessageModel = {
      create: jest.fn(),
    };

    const createMessageHandler = CreateMessageHandler(mockMessageModel as any);

    const aDryRunMessagePayload: IMessagePayload = {
      ...aMessagePayload,
      dry_run: true,
    };

    const mockContext = {
      bindings: {},
    };

    const result = await createMessageHandler(
      mockContext as any,
      {} as any,
      someUserAttributes,
      {} as any,
      aDryRunMessagePayload,
    );

    expect(mockMessageModel.create).not.toHaveBeenCalled();
    expect(mockContext.bindings).toEqual({});
    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.bodyShort).toEqual(aDryRunMessagePayload.body_short);
      expect(result.value.senderOrganizationId).toEqual(someUserAttributes.organization.organizationId);
      expect(result.value.status).toEqual("DRY_RUN_SUCCESS");
    }
  });

  it("should create a new message", async () => {
    const mockMessageModel = {
      create: jest.fn(() => right(aRetrievedMessage)),
    };

    const createMessageHandler = CreateMessageHandler(mockMessageModel as any);

    const mockContext = {
      bindings: {},
      log: jest.fn(),
    };

    const result = await createMessageHandler(
      mockContext as any,
      {} as any,
      someUserAttributes,
      aFiscalCode,
      aMessagePayload,
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    const messageDocument: INewMessage = mockMessageModel.create.mock.calls[0][0];
    expect(messageDocument.bodyShort).toEqual(aMessagePayload.body_short);

    expect(mockMessageModel.create.mock.calls[0][1]).toEqual(aFiscalCode);

    expect(mockContext.bindings).toEqual({
      createdMessage: {
        message: aRetrievedMessage,
      },
    });
    expect(result.kind).toBe("IResponseSuccessRedirectToResource");
    if (result.kind === "IResponseSuccessRedirectToResource") {
      const response = MockResponse();
      result.apply(response);
      expect(response.redirect).toBeCalledWith(202, `/api/v1/messages/${aFiscalCode}/${messageDocument.id}`);
    }
  });

  it("should return failure if creation fails", async () => {
    const mockMessageModel = {
      create: jest.fn(() => left("error")),
    };

    const createMessageHandler = CreateMessageHandler(mockMessageModel as any);

    const mockContext = {
      bindings: {},
      log: jest.fn(),
    };

    const result = await createMessageHandler(
      mockContext as any,
      {} as any,
      someUserAttributes,
      aFiscalCode,
      aMessagePayload,
    );

    expect(mockMessageModel.create).toHaveBeenCalledTimes(1);

    expect(mockContext.bindings).toEqual({});
    expect(result.kind).toBe("IResponseErrorGeneric");
  });

});

describe("GetMessageHandler", () => {

  it("should respond with a message if requesting user is the sender", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(aRetrievedMessage))),
    };

    const getMessageHandler = GetMessageHandler(mockMessageModel as any);

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessage.id,
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode, aRetrievedMessage.id,
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessage);
    }
  });

  it("should respond with a message if requesting user is a trusted application", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(aRetrievedMessage))),
    };

    const getMessageHandler = GetMessageHandler(mockMessageModel as any);

    const userAttributes: IAzureUserAttributes = {
      ...someUserAttributes,
      organization: undefined,
    };

    const result = await getMessageHandler(
      aUserAuthenticationTrustedApplication,
      userAttributes,
      aFiscalCode,
      aRetrievedMessage.id,
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode, aRetrievedMessage.id,
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessage);
    }
  });

  it("should respond with forbidden if requesting user is not the sender", async () => {
    const message = {
      ...aRetrievedMessage,
      senderOrganizationId: "anotherOrg",
    };

    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(some(message))),
    };

    const getMessageHandler = GetMessageHandler(mockMessageModel as any);

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessage.id,
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessage.fiscalCode, aRetrievedMessage.id,
    );

    expect(result.kind).toBe("IResponseErrorForbiddenNotAuthorized");
  });

  it("should respond with not found a message doesn not exist", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(none)),
    };

    const getMessageHandler = GetMessageHandler(mockMessageModel as any);

    const result = await getMessageHandler(
      aUserAuthenticationDeveloper,
      someUserAttributes,
      aFiscalCode,
      aRetrievedMessage.id,
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

});
