export function scrollMainToTop() {
  if (typeof document === 'undefined') return
  const main = document.querySelector('main')
  if (main) {
    main.scrollTop = 0
  }
}
