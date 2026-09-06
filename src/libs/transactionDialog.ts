import { nextTick } from 'vue';

/** Adapt the legacy checkbox modal to native button and keyboard activation. */
export async function openTransactionDialog(type: string) {
  // The custom element has a separate Vue app that renders after its host.
  await nextTick();
  await nextTick();
  const widget = document.querySelector('ping-tx-dialog');
  const toggle = widget?.querySelector<HTMLInputElement>('input.modal-toggle');
  const box = widget?.querySelector<HTMLElement>('.modal-box');
  const close = box?.querySelector<HTMLElement>('label.btn-circle');
  if (!toggle || toggle.id !== type || !box || !close) return;

  const previousFocus = document.activeElement as HTMLElement | null;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', box.querySelector('h3')?.textContent || type);
  close.setAttribute('role', 'button');
  close.setAttribute('aria-label', 'Close dialog');
  close.tabIndex = 0;

  const restoreFocus = () => {
    if (!toggle.checked) previousFocus?.focus();
  };
  toggle.onchange = restoreFocus;
  box.onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      toggle.checked = false;
      restoreFocus();
    } else if (
      event.target === close &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      close.click();
    } else if (event.key === 'Tab') {
      const controls = Array.from(box.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex="0"]'
      )).filter((element) =>
        !element.matches(':disabled') && element.getClientRects().length > 0
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };
  toggle.checked = true;
  close.focus();
}
