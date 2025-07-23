import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const mainElement = document.querySelector('main')
    const handleScroll = () => {
      if (!mainElement) return
      const currentScroll = mainElement.scrollTop || window.pageYOffset

      const isAtBottom =
        mainElement.scrollHeight - mainElement.clientHeight <= currentScroll + 10

      if (currentScroll > 300 && !isAtBottom) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    handleScroll()

    const scrollTarget = mainElement || window
    scrollTarget.addEventListener('scroll', handleScroll)

    return () => scrollTarget.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    try {
      const mainElement = document.querySelector('main')
      if (mainElement) {
        mainElement.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      } else {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }
    } catch (error) {
      console.error('Ошибка при прокрутке:', error)
      const mainElement = document.querySelector('main')
      if (mainElement) {
        mainElement.scrollTop = 0
      } else {
        window.scrollTo(0, 0)
      }
    }
  }

  return isVisible ? (
    <div
      className='fixed bottom-20 right-6 z-[9999] rounded-full w-12 h-12 shadow-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center cursor-pointer'
      onClick={scrollToTop}
      aria-label='Прокрутка вверх'
    >
      <ChevronUp size={30} className='text-white' />
    </div>
  ) : null
}
