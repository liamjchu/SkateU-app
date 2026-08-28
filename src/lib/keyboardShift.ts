export function extraKeyboardPadding(
  keyboardHeight: number,
  _closedBottomPadding = 0,
): number {
  'worklet';
  if (keyboardHeight <= 0) {
    return 0;
  }

  // Use the full keyboard height. closedBottomPadding lives on scroll content
  // or a footer, not on KeyboardShiftView itself, so subtracting it here leaves
  // the child view overlapping the keyboard.
  return keyboardHeight;
}
