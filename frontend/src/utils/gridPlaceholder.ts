/** Blank placeholder on trailing grid rows; labels only on filled rows. */
export function gridCellPlaceholder(text: string, isBlankRow: boolean): string {
  return isBlankRow ? '' : text
}
