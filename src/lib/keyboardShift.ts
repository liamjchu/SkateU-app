export function extraKeyboardPadding(
  keyboardHeight: number,
  closedBottomPadding: number,
): number {
  'worklet';
  if (keyboardHeight <= 0) {
    return 0;
  }

  return Math.max(0, keyboardHeight - closedBottomPadding);
}
