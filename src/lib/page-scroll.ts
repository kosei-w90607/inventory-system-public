const PAGE_TOP_SCROLL_OPTIONS: ScrollToOptions = { top: 0, behavior: "smooth" };

export function scrollPageToTop(): void {
  const main = document.querySelector("main");
  if (main instanceof HTMLElement && typeof main.scrollTo === "function") {
    main.scrollTo(PAGE_TOP_SCROLL_OPTIONS);
    return;
  }

  window.scrollTo(PAGE_TOP_SCROLL_OPTIONS);
}
