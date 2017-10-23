// tslint:disable:object-literal-sort-keys

// DO NOT EDIT
// auto-generated by generated_model.ts from public_api_v1.yaml

export const specs = {
  swagger: "2.0",
  info: {
    version: "0.0.1",
    title: "Digital Citizenship API",
    description: "Digital Citizenship API."
  },
  host: "localhost",
  basePath: "/api/v1",
  schemes: ["https"],
  security: [{ SubscriptionKey: [] }],
  paths: {
    "/messages/{fiscal_code}/{id}": {
      parameters: [
        { $ref: "#/parameters/FiscalCode" },
        {
          name: "id",
          in: "path",
          type: "string",
          required: true,
          description: "The ID of the message."
        }
      ],
      get: {
        operationId: "getMessage",
        summary: "Get Message",
        description:
          "The previously created message with the provided message ID is returned.",
        responses: {
          "200": {
            description: "Message found.",
            schema: { $ref: "#/definitions/MessageResponse" },
            examples: {}
          },
          "404": { description: "No message found for the provided ID." }
        }
      }
    },
    "/messages/{fiscal_code}": {
      parameters: [{ $ref: "#/parameters/FiscalCode" }],
      get: {
        operationId: "getMessagesByUser",
        summary: "Get messages by user",
        description:
          'Returns the messages for the user identified by the provided fiscal code.\nMessages will be returned in inverse acceptance order (from last to first).\nThe "next" field, when present, contains an URL pointing to the next page of results.',
        responses: {
          "200": {
            description: "Found.",
            schema: {
              allOf: [
                {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/definitions/CreatedMessage" }
                    }
                  }
                },
                { $ref: "#/definitions/PaginationResponse" }
              ]
            }
          },
          "404": { description: "No message found." }
        },
        parameters: [{ $ref: "#/parameters/PaginationRequest" }]
      },
      post: {
        operationId: "submitMessageforUser",
        summary: "Submit a message",
        description:
          "Submits a message to a user.\nOn error, the reason is returned in the response payload.",
        parameters: [
          {
            name: "message",
            in: "body",
            schema: { $ref: "#/definitions/NewMessage" }
          }
        ],
        responses: {
          "201": {
            description: "Message created.",
            headers: {
              Location: {
                type: "string",
                description:
                  "Location (URL) of created message resource.\nA GET request to this URL returns the message status and details."
              }
            }
          },
          "400": {
            description: "Invalid payload.",
            schema: { $ref: "#/definitions/ProblemJson" },
            examples: {}
          },
          "500": {
            description: "The message cannot be delivered.",
            schema: { $ref: "#/definitions/ProblemJson" }
          }
        }
      }
    },
    "/profiles/{fiscal_code}": {
      get: {
        operationId: "getProfile",
        summary: "Get User's Preferences",
        description:
          "Returns the preferences for the user identified by the provided fiscal code.",
        responses: {
          "200": {
            description: "Found.",
            schema: {
              allOf: [
                { $ref: "#/definitions/LimitedProfile" },
                { $ref: "#/definitions/ExtendedProfile" }
              ]
            },
            examples: {}
          },
          "404": { description: "No user found for the provided fiscal code." }
        }
      },
      parameters: [{ $ref: "#/parameters/FiscalCode" }]
    },
    "/info": {
      get: {
        operationId: "getInfo",
        summary: "API test endpoint",
        responses: {
          "200": {
            description: "Returns success if the API-Key is right.",
            schema: { type: "object", properties: {} }
          },
          "401": {
            description:
              "Returns unauthorized when the API-key if empty or wrong."
          }
        },
        description:
          "An endpoint to test authenticated access to the API backend."
      }
    }
  },
  definitions: {
    ProblemJson: {
      title: "Problem Type",
      type: "object",
      properties: {
        type: {
          type: "string",
          format: "uri",
          description:
            "An absolute URI that identifies the problem type. When dereferenced,\nit SHOULD provide human-readable documentation for the problem type\n(e.g., using HTML).\n",
          default: "about:blank",
          example: "https://example.com/problem/constraint-violation"
        },
        title: {
          type: "string",
          description:
            "A short, summary of the problem type. Written in english and readable\nfor engineers (usually not suited for non technical stakeholders and\nnot localized); example: Service Unavailable\n"
        },
        status: { $ref: "#/definitions/HttpStatusCode" },
        detail: {
          type: "string",
          description:
            "A human readable explanation specific to this occurrence of the\nproblem.\n",
          example: "Connection to database timed out"
        },
        instance: {
          type: "string",
          format: "uri",
          description:
            "An absolute URI that identifies the specific occurrence of the problem.\nIt may or may not yield further information if dereferenced."
        }
      }
    },
    MessageContent: {
      title: "MessageContent",
      type: "object",
      properties: {
        subject: { $ref: "#/definitions/MessageSubject" },
        markdown: { $ref: "#/definitions/MessageBodyMarkdown" }
      },
      required: ["markdown"]
    },
    NewMessage: {
      title: "NewMessage",
      type: "object",
      properties: {
        time_to_live: { $ref: "#/definitions/TimeToLive" },
        content: { $ref: "#/definitions/MessageContent" },
        default_addresses: { $ref: "#/definitions/NewMessageDefaultAddresses" }
      },
      required: ["content"]
    },
    NotificationChannelStatus: {
      type: "string",
      "x-extensible-enum": ["QUEUED", "SENT_TO_CHANNEL"]
    },
    NotificationStatus: {
      title: "NotificationStatus",
      type: "object",
      properties: { email: { $ref: "#/definitions/NotificationChannelStatus" } }
    },
    CreatedMessage: {
      title: "CreatedMessage",
      type: "object",
      properties: {
        id: { type: "string" },
        fiscal_code: { $ref: "#/definitions/FiscalCode" },
        time_to_live: { $ref: "#/definitions/TimeToLive" },
        content: { $ref: "#/definitions/MessageContent" },
        sender_organization_id: { type: "string" }
      },
      required: ["fiscal_code", "sender_organization_id"]
    },
    MessageResponse: {
      type: "object",
      properties: {
        message: { $ref: "#/definitions/CreatedMessage" },
        notification: { $ref: "#/definitions/NotificationStatus" }
      },
      required: ["message"]
    },
    FiscalCode: {
      type: "string",
      description: "User's fiscal code.",
      pattern:
        "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$"
    },
    MessageSubject: {
      type: "string",
      description:
        "The (optional) subject of the message - note that only some notification\nchannels support the display of a subject. When a subject is not provided,\none gets generated from the client attributes.",
      minLength: 10,
      maxLength: 120
    },
    MessageBodyMarkdown: {
      type: "string",
      description:
        "The full version of the message, in plain text or Markdown format. The\ncontent of this field will be delivered to channels that don't have any\nlimit in terms of content size (e.g. email, etc...).",
      minLength: 80,
      maxLength: 10000
    },
    PaginationResponse: {
      type: "object",
      title: "pagination",
      description: "Pagination response parameters.",
      properties: {
        page_size: {
          type: "integer",
          minimum: 1,
          description: "Number of items returned for each page."
        },
        next: {
          type: "string",
          description:
            "Contains an URL to GET the next #<page_size> results in the retrieved collection of items.",
          format: "uri"
        }
      }
    },
    LimitedProfile: {
      title: "A citizen's profile",
      description:
        "Describes the citizen's profile, mostly interesting for preferences attributes.",
      type: "object",
      properties: {
        preferred_languages: { $ref: "#/definitions/PreferredLanguages" }
      }
    },
    ExtendedProfile: {
      title: "A citizen's profile",
      description:
        "Describes the citizen's profile, mostly interesting for preferences attributes.",
      type: "object",
      properties: {
        email: { $ref: "#/definitions/EmailAddress" },
        preferred_languages: { $ref: "#/definitions/PreferredLanguages" },
        version: { type: "integer" }
      }
    },
    TimeToLive: {
      type: "integer",
      minimum: 3600,
      maximum: 31536000,
      description:
        "This parameter specifies for how long (in seconds) the system will try to deliver the message to the channels configured by the user."
    },
    HttpStatusCode: {
      type: "integer",
      format: "int32",
      description:
        "The HTTP status code generated by the origin server for this occurrence\nof the problem.\n",
      minimum: 100,
      maximum: 600,
      exclusiveMaximum: true,
      example: 503
    },
    NewMessageDefaultAddresses: {
      type: "object",
      description:
        "Default addresses for notifying the recipient of the message.",
      properties: {
        email: {
          $ref: "#/definitions/EmailAddress",
          description:
            "The recipient will be notified to this email address in case no email is set in the recipient profile."
        }
      }
    },
    EmailAddress: { type: "string", format: "email" },
    PreferredLanguage: {
      type: "string",
      "x-extensible-enum": ["it_IT", "en_GB", "es_ES", "de_DE", "fr_FR"]
    },
    PreferredLanguages: {
      type: "array",
      items: { $ref: "#/definitions/PreferredLanguage" },
      description:
        "Indicates the User's preferred written or spoken languages in order of preference. Generally used for selecting a localized User interface. Valid values are concatenation of the ISO 639-1 two letter language code, an underscore, and the ISO 3166-1 2 letter country code; e.g., 'en_US' specifies the language English and country US."
    }
  },
  responses: {},
  parameters: {
    PaginationRequest: {
      name: "cursor",
      in: "query",
      type: "string",
      minimum: 1,
      description:
        "An opaque identifier that points to the next item in the collection."
    },
    FiscalCode: {
      name: "fiscal_code",
      in: "path",
      type: "string",
      maxLength: 16,
      minLength: 16,
      required: true,
      description: "The fiscal code of the user, all upper case.",
      pattern:
        "[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]"
    }
  },
  consumes: ["application/json"],
  produces: ["application/json"],
  securityDefinitions: {
    SubscriptionKey: {
      type: "apiKey",
      name: "Ocp-Apim-Subscription-Key",
      in: "header",
      description: "The API key obtained through the developer portal."
    }
  }
};
