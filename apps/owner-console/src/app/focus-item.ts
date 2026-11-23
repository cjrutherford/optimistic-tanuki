/** Id prefix of an element the moderation queue can ask a page to scroll to. */
export const FOCUS_ID_PREFIX = 'report-';

/**
 * The moderation queue opens detail pages with `?focus=<item id>`. Pages mark
 * that item and scroll it into view once their list has rendered.
 */
export function scrollToFocused(id: string | null | undefined): void {
  if (!id || typeof document === 'undefined') return;
  setTimeout(() =>
    document
      .getElementById(`${FOCUS_ID_PREFIX}${id}`)
      ?.scrollIntoView?.({ block: 'center' })
  );
}
