import { useEffect, useState } from 'react'
import type { CarouselApi } from '~/components/ui/carousel'

interface UseArrowToggleReturn<T> {
  currentId: T | undefined
  setCurrentId: React.Dispatch<React.SetStateAction<T | undefined>>
}

export function useArrowToggle<T>(
  ids: T[] | ((value: T | undefined) => T[]),
): UseArrowToggleReturn<T> {
  const [currentId, setCurrentId] = useState<T | undefined>(undefined)

  if (typeof ids === 'function') {
    ids = ids(currentId)
  }

  // Обработчик нажатия клавиш
  const handleKeyDown = (event: KeyboardEvent) => {
    // Если currentId еще не задан (undefined), выход
    if (currentId === undefined) return

    // Узнаем позицию текущего ID в массиве
    const index = ids.indexOf(currentId)

    // Переключение при нажатии ArrowLeft
    if (event.key === 'ArrowLeft') {
      // Проверяем, чтобы не выйти за пределы массива
      if (index > 0) {
        setCurrentId(ids[index - 1])
      }
    }

    // Переключение при нажатии ArrowRight
    if (event.key === 'ArrowRight') {
      if (index < ids.length - 1) {
        setCurrentId(ids[index + 1])
      }
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    // Очистка, когда компонент размонтируется или изменится зависимость
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentId, ids])

  return { currentId, setCurrentId }
}

export function useArrowCarousel(api: CarouselApi) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      api?.scrollPrev()
    }

    if (event.key === 'ArrowRight') {
      api?.scrollNext()
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [api])
}
