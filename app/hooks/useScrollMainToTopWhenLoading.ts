import { useLayoutEffect, useRef } from 'react'

import { getSidebarSection } from '~/utils/employeeSidebarNavigation'
import { scrollMainToTop } from '~/utils/scrollMainToTop'

function scrollMainToTopRepeated() {
  scrollMainToTop()
  requestAnimationFrame(() => {
    scrollMainToTop()
    requestAnimationFrame(scrollMainToTop)
  })
}

export function useScrollMainToTopWhenLoading(isLoading: boolean) {
  useLayoutEffect(() => {
    if (!isLoading) return
    scrollMainToTopRepeated()
  }, [isLoading])

  useLayoutEffect(() => {
    if (isLoading) return
    scrollMainToTopRepeated()
  }, [isLoading])
}

export function useScrollMainToTopOnSectionIdle(
  pathname: string,
  navigationState: string,
) {
  const section = getSidebarSection(pathname)
  const sectionWhenLoadingStartedRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (navigationState === 'loading') {
      sectionWhenLoadingStartedRef.current = getSidebarSection(pathname)
      return
    }
    if (navigationState !== 'idle') return
    if (!section) return

    const sectionWhenLoadingStarted = sectionWhenLoadingStartedRef.current
    sectionWhenLoadingStartedRef.current = null
    if (sectionWhenLoadingStarted === null) return
    if (sectionWhenLoadingStarted === section) return

    scrollMainToTopRepeated()
  }, [navigationState, section, pathname])
}
