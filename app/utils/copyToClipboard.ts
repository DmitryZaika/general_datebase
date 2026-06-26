function copyWithExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '2em'
  textarea.style.height = '2em'
  textarea.style.padding = '0'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.boxShadow = 'none'
  textarea.style.background = 'transparent'
  textarea.style.fontSize = '16px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}

function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const normalized = text.trim()
  if (!normalized) return false

  if (isAppleMobile()) {
    return copyWithExecCommand(normalized)
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalized)
      return true
    }
  } catch {
    return copyWithExecCommand(normalized)
  }

  return copyWithExecCommand(normalized)
}
