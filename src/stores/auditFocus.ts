/**
 * The audit control a class detail was opened from, so closing the detail
 * can put focus back where the student left it. Module state rather than
 * a store entry: nothing here is saved, shared, or worth a subscription.
 */

let origin: HTMLElement | null = null;

export function rememberAuditOrigin(control: HTMLElement | null): void {
  origin = control;
}

/**
 * Focus the remembered control and bring it into view, once. A control
 * that left the DOM while the detail was open (a road switch, a removed
 * program) is skipped, and so is a return while focus sits somewhere live,
 * such as a canvas card the student moved to with the detail still open.
 */
export function returnToAuditOrigin(): void {
  const control = origin;
  origin = null;
  const active = document.activeElement;
  if (
    control?.isConnected !== true ||
    (active !== null && active !== document.body)
  ) {
    return;
  }
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: "nearest" });
}

export function clearAuditOrigin(): void {
  origin = null;
}
