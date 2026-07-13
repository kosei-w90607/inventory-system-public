import { afterEach, describe, expect, it, vi } from "vitest";

import { scrollPageToTop } from "./page-scroll";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("REQ-201/REQ-202/REQ-203/REQ-204 save result page scroll", () => {
  it("scrolls the RootLayout main container when present", () => {
    const main = document.createElement("main");
    const mainScrollTo = vi.fn();
    main.scrollTo = mainScrollTo;
    document.body.append(main);
    const windowScrollTo = vi.fn();
    vi.stubGlobal("scrollTo", windowScrollTo);

    scrollPageToTop();

    expect(mainScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(windowScrollTo).not.toHaveBeenCalled();
  });

  it("falls back to window scrolling outside RootLayout", () => {
    const windowScrollTo = vi.fn();
    vi.stubGlobal("scrollTo", windowScrollTo);

    scrollPageToTop();

    expect(windowScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
