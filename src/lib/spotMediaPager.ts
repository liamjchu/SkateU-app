export function shouldMountPagerImage(
  photoIndex: number,
  currentIndex: number
): boolean {
  return Math.abs(photoIndex - currentIndex) <= 1;
}

