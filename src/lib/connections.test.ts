import { describe, expect, it } from "vitest";
import {
  compatible,
  connLabel,
  defaultConnType,
  groupStyles,
  groupTransports,
  styleAfterTransportChange,
  wireType,
} from "./connections";
import { STANDARD } from "./standardLibrary";

const c = (transportId: string, styleId: string) => ({ transportId, styleId });
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("compatible", () => {
  it("needs the same transport", () => {
    expect(compatible(c("tr-http", "s-rest"), c("tr-http", "s-rest"))).toBe(true);
    expect(compatible(c("tr-http", "s-any"), c("tr-tcp", "s-any"))).toBe(false);
  });

  it("needs the same style, unless either side is 'any' (pass-through)", () => {
    expect(compatible(c("tr-http", "s-rest"), c("tr-http", "s-graphql"))).toBe(false);
    expect(compatible(c("tr-http", "s-any"), c("tr-http", "s-rest"))).toBe(true);
    expect(compatible(c("tr-http", "s-rest"), c("tr-http", "s-any"))).toBe(true);
  });
});

describe("wireType", () => {
  it("carries the more specific style", () => {
    expect(wireType(c("tr-http", "s-any"), c("tr-http", "s-rest"))).toEqual(c("tr-http", "s-rest"));
    expect(wireType(c("tr-http", "s-rest"), c("tr-http", "s-any"))).toEqual(c("tr-http", "s-rest"));
    expect(wireType(c("tr-http", "s-any"), c("tr-http", "s-any"))).toEqual(c("tr-http", "s-any"));
  });
});

describe("connLabel", () => {
  it("names both parts, or just the transport for 'any'", () => {
    expect(connLabel(c("tr-http", "s-rest"), STANDARD.transports, STANDARD.styles)).toBe("HTTP / REST/JSON");
    expect(connLabel(c("tr-http", "s-any"), STANDARD.transports, STANDARD.styles)).toBe("HTTP");
  });
});

describe("node dialog ordering", () => {
  it("lists network transports first on Containers, In-process first on Components", () => {
    expect(names(groupTransports(STANDARD.transports, ["container"]).other)).toEqual(["In-process"]);
    expect(names(groupTransports(STANDARD.transports, ["component"]).usual)).toEqual(["Filesystem", "In-process"]);
  });

  it("orders styles by the chosen transport, 'any' first, nothing hidden", () => {
    const http = groupStyles(STANDARD.styles, "tr-http");
    expect(names(http.usual)).toEqual(["any", "REST/JSON", "GraphQL", "SOAP/XML", "Web pages"]);
    expect(http.usual.length + http.other.length).toBe(Object.keys(STANDARD.styles).length);
    expect(names(groupStyles(STANDARD.styles, "tr-tcp").usual)).toEqual(["any", "SQL", "Key-value"]);
  });

  it("defaults a new pip to the layer's usual transport and its most common style", () => {
    expect(defaultConnType(STANDARD.transports, STANDARD.styles, ["container"])).toEqual(c("tr-http", "s-rest"));
    expect(defaultConnType(STANDARD.transports, STANDARD.styles, ["component"])).toEqual(c("tr-inproc", "s-call"));
  });
});

describe("styleAfterTransportChange", () => {
  const { transports, styles } = STANDARD;

  it("keeps a style that still fits the new transport", () => {
    // Event is usual on both message queues and WebSockets
    expect(styleAfterTransportChange("s-event", "tr-ws", transports, styles)).toBe("s-event");
    expect(styleAfterTransportChange("s-any", "tr-tcp", transports, styles)).toBe("s-any");
  });

  it("otherwise switches to the new transport's default style", () => {
    // REST/JSON doesn't ride on a message queue; the queue's default is Event
    expect(styleAfterTransportChange("s-rest", "tr-queue", transports, styles)).toBe("s-event");
  });

  it("falls back to any when the new transport has no default", () => {
    expect(styleAfterTransportChange("s-rest", "tr-fs", transports, styles)).toBe("s-any");
  });
});
