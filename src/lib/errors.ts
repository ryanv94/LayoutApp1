export function showError(box: HTMLElement, message: string): void {
  box.textContent = message;
  box.hidden = false;
}

export function clearError(box: HTMLElement): void {
  box.textContent = '';
  box.hidden = true;
}
