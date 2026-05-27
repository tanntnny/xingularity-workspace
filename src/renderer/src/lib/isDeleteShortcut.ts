export function isDeleteShortcut(event: { metaKey: boolean; key: string }): boolean {
  return event.metaKey && (event.key === 'Backspace' || event.key === 'Delete')
}
