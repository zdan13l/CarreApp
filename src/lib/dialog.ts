// Pretty pop-ups instead of the browser's plain confirm() / prompt(). `confirmDialog` and `promptDialog` return a
// promise, so a call site reads like the old code: `if (!(await confirmDialog({ ... }))) return`.
// The pop-up itself is drawn by <DialogHost /> (mounted once in App.tsx).

export type DialogIcon = 'question' | 'warning' | 'bell' | 'logout' | 'trash' | 'send' | 'check'

export interface DialogOptions {
  title: string
  message?: string // plain text; line breaks are kept
  details?: string[] // short lines shown as a list (for example what is about to be sent)
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  icon?: DialogIcon
}

export interface PromptOptions extends DialogOptions {
  defaultValue?: string
  placeholder?: string
  label?: string
  multiline?: boolean
}

export type DialogRequest =
  | { kind: 'confirm'; options: DialogOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (text: string | null) => void }

type Listener = (request: DialogRequest) => void
let listener: Listener | null = null

export function registerDialogHost(fn: Listener | null) {
  listener = fn
}

export function confirmDialog(options: DialogOptions): Promise<boolean> {
  if (!listener) return Promise.resolve(typeof window !== 'undefined' ? window.confirm([options.title, options.message].filter(Boolean).join('\n\n')) : false)
  return new Promise((resolve) => listener!({ kind: 'confirm', options, resolve }))
}

// Resolves with the text (trimmed) or null when cancelled or left empty.
export function promptDialog(options: PromptOptions): Promise<string | null> {
  if (!listener) return Promise.resolve(typeof window !== 'undefined' ? window.prompt(options.title, options.defaultValue ?? '') : null)
  return new Promise((resolve) => listener!({ kind: 'prompt', options, resolve }))
}
