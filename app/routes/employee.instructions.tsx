import { useCallback, useMemo, useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import '~/styles/instructions.css'
import type { Instruction } from '~/types'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'

interface InstructionNode {
  id: number
  title: string | null
  text: string
  after_id: number | null
  children: InstructionNode[]
  parent_id?: number | null
}

interface InstructionItemProps {
  instruction: InstructionNode
  className?: string
  id?: string
  isSelected?: boolean
  selectedId?: number | null
  onToggle: (openIds: string[], allSiblingIds: number[]) => void
}

// Компонент элемента навигации для боковой панели
interface OutlineItemProps {
  section: InstructionNode
  level: number
  onSelect: (id: number) => void
  selectedId: number | null
  expandedIds: number[]
}

const OutlineItem: React.FC<OutlineItemProps> = ({
  section,
  level = 0,
  onSelect,
  selectedId,
  expandedIds,
}) => {
  const hasChildren = section.children.length > 0
  const indent = level * 12 // Отступ для уровней вложенности
  const isSelected = selectedId === section.id
  // Проверяем, является ли этот элемент одним из открытых аккордеонов
  const isExpanded = expandedIds.includes(section.id)

  // Стили в зависимости от уровня вложенности
  let levelStyles = ''
  if (level === 0) {
    // Стили для основных заголовков (level 0)
    levelStyles = 'font-medium text-gray-900'
  } else if (level === 1) {
    // Стили для подзаголовков первого уровня (level 1)
    levelStyles = 'text-gray-700'
  } else {
    // Стили для подзаголовков глубже (level 2+)
    levelStyles = 'text-gray-600 text-sm'
  }

  // Подсвечиваем, если элемент выбран ИЛИ если он раскрыт (expanded)
  const highlightClass = isSelected || isExpanded ? 'bg-blue-100 font-medium' : ''

  return (
    <div className='gdoc-outline-item'>
      <div
        className={`py-1 cursor-pointer hover:bg-gray-100 rounded ${levelStyles} ${highlightClass}`}
        style={{ paddingLeft: `${indent + 8}px`, userSelect: 'none' }}
        onClick={() => onSelect(section.id)}
      >
        {section.title || 'Untitled'}
      </div>

      {hasChildren &&
        section.children.map(child => (
          <OutlineItem
            key={child.id}
            section={child}
            level={level + 1}
            onSelect={onSelect}
            selectedId={selectedId}
            expandedIds={expandedIds}
          />
        ))}
    </div>
  )
}

function isHtmlEmpty(html: string): boolean {
  const cleaned = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/\s/g, '')
    .trim()
  return cleaned.length === 0
}

const InstructionItem: React.FC<InstructionItemProps> = ({
  instruction,
  id,
  isSelected,
  selectedId,
  onToggle,
}) => {
  const hasTitle = Boolean(instruction.title)
  const isEmptyText = isHtmlEmpty(instruction.text)
  const itemId = id || `instruction-${instruction.id}`

  if (hasTitle) {
    return (
      <AccordionItem value={instruction.id.toString()} id={itemId}>
        <AccordionTrigger
          className={`py-4 underline underline-offset-4 ${isSelected ? 'bg-blue-100 font-medium' : ''}`}
        >
          {instruction.title}
        </AccordionTrigger>
        <AccordionContent>
          {!isEmptyText && (
            <div
              className='prose max-w-[calc(100%-50px)] md:max-w-[calc(100%-75px)] lg:max-w-[calc(100%-65px)] w-full instructions ml-3 sm:ml-5 md:ml-10'
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
              dangerouslySetInnerHTML={{ __html: instruction.text }}
            />
          )}
          {instruction.children.length > 0 && (
            <Accordion
              type='multiple'
              className='ml-5'
              onValueChange={values =>
                onToggle(
                  values,
                  instruction.children.map(c => c.id),
                )
              }
            >
              {instruction.children.map(childInstruction => (
                <InstructionItem
                  key={childInstruction.id}
                  instruction={childInstruction}
                  id={`instruction-${childInstruction.id}`}
                  isSelected={selectedId === childInstruction.id}
                  selectedId={selectedId}
                  onToggle={onToggle}
                />
              ))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    )
  } else {
    return (
      <div className='py-4' id={itemId}>
        {!isEmptyText && (
          <div
            className='prose overflow-auto break-words w-full ml-5'
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Its safe
            dangerouslySetInnerHTML={{ __html: instruction.text }}
          />
        )}
        {instruction.children.length > 0 && (
          <div className='ml-5'>
            {instruction.children.map(childInstruction => (
              <InstructionItem
                key={childInstruction.id}
                instruction={childInstruction}
                id={`instruction-${childInstruction.id}`}
                isSelected={selectedId === childInstruction.id}
                selectedId={selectedId}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>
    )
  }
}

function cleanData(instructions: Instruction[]): InstructionNode[] {
  const nodeMap = new Map<number, InstructionNode>()

  // Создаем узлы
  instructions.forEach(item => {
    nodeMap.set(item.id, {
      id: item.id,
      title: item.title,
      text: item.rich_text,
      after_id: item.after_id,
      parent_id: item.parent_id,
      children: [],
    })
  })

  const rootNodes: InstructionNode[] = []
  const insertNodeInOrder = (nodes: InstructionNode[], node: InstructionNode) => {
    if (node.after_id === null) {
      nodes.unshift(node)
    } else {
      const index = nodes.findIndex(n => n.id === node.after_id)
      if (index !== -1) {
        nodes.splice(index + 1, 0, node)
      } else {
        nodes.push(node)
      }
    }
  }

  instructions.forEach(item => {
    const node = nodeMap.get(item.id)
    if (!node) {
      return
    }
    if (item.parent_id === null) {
      insertNodeInOrder(rootNodes, node)
    } else {
      const parentNode = nodeMap.get(item.parent_id)
      if (parentNode) {
        insertNodeInOrder(parentNode.children, node)
      }
    }
  })

  return rootNodes
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getEmployeeUser(request)
  const instructions = await selectMany<Instruction>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text FROM instructions WHERE company_id = ?',
    [user.company_id],
  )
  return { instructions }
}

export default function Instructions() {
  const { instructions } = useLoaderData<typeof loader>()
  const finalInstructions = cleanData(instructions)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  const nodeMap = new Map<number, InstructionNode>()
  const populateNodeMap = (nodes: InstructionNode[]) => {
    nodes.forEach(node => {
      nodeMap.set(node.id, node)
      if (node.children.length > 0) {
        populateNodeMap(node.children)
      }
    })
  }
  populateNodeMap(finalInstructions)

  const findPathToNode = (
    nodes: InstructionNode[],
    targetId: number,
    currentPath: number[] = [],
  ): number[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...currentPath, node.id]
      }
      if (node.children.length > 0) {
        const path = findPathToNode(node.children, targetId, [...currentPath, node.id])
        if (path) return path
      }
    }
    return null
  }

  const getDescendants = useCallback(
    (nodes: InstructionNode[], targetId: number): number[] => {
      const descendants: number[] = []

      const traverse = (list: InstructionNode[]): boolean => {
        for (const node of list) {
          if (node.id === targetId) {
            const collect = (n: InstructionNode) => {
              n.children.forEach(c => {
                descendants.push(c.id)
                collect(c)
              })
            }
            collect(node)
            return true // found
          }
          if (node.children.length > 0) {
            if (traverse(node.children)) return true
          }
        }
        return false
      }
      traverse(nodes)
      return descendants
    },
    [],
  )

  const handleExpansionChange = useCallback(
    (currentOpenValues: string[], allSiblingIds: number[]) => {
      const currentOpenIds = currentOpenValues.map(Number)
      const siblingsSet = new Set(allSiblingIds)

      // Сбрасываем selectedId, если закрывается выбранный элемент или его родитель
      const closedIdsForSelect = allSiblingIds.filter(
        id => expandedIds.includes(id) && !currentOpenIds.includes(id),
      )
      if (closedIdsForSelect.length > 0) {
        const idsToRemove = new Set<number>(closedIdsForSelect)
        closedIdsForSelect.forEach(id =>
          getDescendants(finalInstructions, id).forEach(d => idsToRemove.add(d)),
        )
        if (selectedId && idsToRemove.has(selectedId)) {
          setSelectedId(null)
        }
      }

      setExpandedIds(prev => {
        // Identify which IDs were closed
        const closedIds = allSiblingIds.filter(
          id => prev.includes(id) && !currentOpenIds.includes(id),
        )

        // Remove closed IDs AND their descendants
        const idsToRemove = new Set<number>()
        closedIds.forEach(id => {
          idsToRemove.add(id)
          const descendants = getDescendants(finalInstructions, id)
          descendants.forEach(d => idsToRemove.add(d))
        })

        const prevFiltered = prev.filter(
          id => !idsToRemove.has(id) && !siblingsSet.has(id),
        )
        return [...prevFiltered, ...currentOpenIds]
      })
    },
    [finalInstructions, getDescendants, expandedIds, selectedId],
  )

  const navigateToInstruction = useCallback(
    async (id: number) => {
      // Если клик по уже выбранному или раскрытому элементу -> сворачиваем
      if (selectedId === id || expandedIds.includes(id)) {
        setSelectedId(null)
        const triggerBtn = document.querySelector(
          `#instruction-${id} button[data-state="open"]`,
        ) as HTMLElement | null
        if (triggerBtn) {
          triggerBtn.click()
        }

        // Удаляем текущий ID и всех его потомков из expandedIds
        const descendants = getDescendants(finalInstructions, id)
        const idsToRemove = new Set([id, ...descendants])
        setExpandedIds(prev => prev.filter(expId => !idsToRemove.has(expId)))

        return
      }

      setSelectedId(id)
      // Временно сбрасываем через 2 сек (как было), или оставляем перманентно?
      // В оригинале было setTimeout(() => setSelectedId(null), 2000)
      // Если нужно "подсвечивать синим все открытые вкладки", то, вероятно,
      // логика сброса через 2с конфликтует с постоянной подсветкой.
      // Оставим подсветку "текущего выбранного" (selectedId) постоянной,
      // пока пользователь не кликнет снова или не выберет другой.
      // setTimeout убрал, чтобы выделение сохранялось.

      const path = findPathToNode(finalInstructions, id)
      if (!path) return

      // Обновляем expandedIds: добавляем весь путь к уже существующим
      setExpandedIds(prev => {
        const next = new Set(prev)
        path.forEach(pId => next.add(pId))
        return Array.from(next)
      })

      // Sequentially open accordions from top to bottom
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i]

        // Wait a bit for potential previous expansion animations
        if (i > 0) await new Promise(resolve => setTimeout(resolve, 100))

        const itemElement = document.getElementById(`instruction-${nodeId}`)

        if (itemElement) {
          const trigger = itemElement.querySelector(
            'button[data-state]',
          ) as HTMLElement | null

          if (trigger) {
            const state = trigger.getAttribute('data-state')
            if (state === 'closed') {
              trigger.click()
            }
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 100))
          const retryElement = document.getElementById(`instruction-${nodeId}`)
          if (retryElement) {
            const trigger = retryElement.querySelector(
              'button[data-state]',
            ) as HTMLElement | null
            if (trigger && trigger.getAttribute('data-state') === 'closed') {
              trigger.click()
            }
          }
        }
      }

      // Finally scroll to the target
      setTimeout(() => {
        const targetElement = document.getElementById(`instruction-${id}`)
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 200)
    },
    [selectedId, finalInstructions],
  )

  const [searchTerm, setSearchTerm] = useState('')

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    const results: { id: number; title: string; matchType: 'Title' | 'Content' }[] = []

    const traverse = (nodes: InstructionNode[]) => {
      for (const node of nodes) {
        const title = node.title || ''
        const text = node.text.replace(/<[^>]*>/g, '') // strip HTML

        const titleMatch = title.toLowerCase().includes(term)
        const textMatch = text.toLowerCase().includes(term)

        if (titleMatch || textMatch) {
          results.push({
            id: node.id,
            title: title || 'Untitled',
            matchType: titleMatch ? 'Title' : 'Content',
          })
        }

        if (node.children.length > 0) {
          traverse(node.children)
        }
      }
    }

    traverse(finalInstructions)
    return results
  }, [searchTerm, finalInstructions])

  const visibleExpandedIds = useMemo(() => {
    const expandedSet = new Set(expandedIds)
    return expandedIds.filter(id => {
      let current = nodeMap.get(id)
      while (current && current.parent_id) {
        if (!expandedSet.has(current.parent_id)) {
          return false
        }
        current = nodeMap.get(current.parent_id)
      }
      return true
    })
  }, [expandedIds, nodeMap])

  return (
    <PageLayout title='Instructions'>
      <div className='flex w-full mt-0'>
        <div className='flex-grow'>
          <Accordion
            type='multiple'
            onValueChange={values =>
              handleExpansionChange(
                values,
                finalInstructions.map(i => i.id),
              )
            }
          >
            {finalInstructions.map(instruction => (
              <InstructionItem
                key={instruction.id}
                instruction={instruction}
                id={`instruction-${instruction.id}`}
                isSelected={selectedId === instruction.id}
                selectedId={selectedId}
                onToggle={handleExpansionChange}
              />
            ))}
          </Accordion>
        </div>

        <div
          className='w-64 shrink-0 bg-white border rounded-lg shadow-sm overflow-auto sm:block hidden ml-4'
          style={{ userSelect: 'none', marginTop: '0' }}
        >
          <div className='p-3 border-b bg-gray-50 sticky top-0 z-10'>
            <h3 className='text-lg font-medium mb-2'>Outline</h3>
            <Input
              placeholder='Search...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='bg-white h-8'
            />
          </div>

          <div className='p-2'>
            {searchTerm ? (
              searchResults.length > 0 ? (
                <div className='flex flex-col gap-1'>
                  {searchResults.map(res => (
                    <div
                      key={res.id}
                      onClick={() => navigateToInstruction(res.id)}
                      className='text-sm p-2 hover:bg-gray-100 rounded cursor-pointer'
                    >
                      <div className='font-medium'>{res.title}</div>
                      <div className='text-xs text-gray-500'>
                        Found in {res.matchType}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-sm text-gray-500 p-2'>No results found</div>
              )
            ) : (
              finalInstructions.map(section => (
                <OutlineItem
                  key={section.id}
                  section={section}
                  level={0}
                  onSelect={navigateToInstruction}
                  selectedId={selectedId}
                  expandedIds={visibleExpandedIds}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
