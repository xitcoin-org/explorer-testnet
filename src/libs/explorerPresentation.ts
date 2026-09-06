export function walletPublicName(chain: { prettyName?: string; chainName: string }): string {
  return chain.prettyName || chain.chainName;
}
export function externalPrice(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
/** A failed optional wallet image is replaced once, without retrying the third party. */
export function walletImageFallback(img: HTMLImageElement): void {
  if (img.closest('ping-connect-wallet') && !img.src.endsWith('/assets/wallets/fallback.svg')) {
    img.src = '/assets/wallets/fallback.svg';
    img.alt = '';
  }
}
