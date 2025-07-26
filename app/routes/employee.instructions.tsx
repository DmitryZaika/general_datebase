import { useCallback, useState } from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
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
}

// Компонент элемента навигации для боковой панели
interface OutlineItemProps {
  section: InstructionNode
  level: number
  onSelect: (id: number) => void
  selectedId: number | null
}

const OutlineItem: React.FC<OutlineItemProps> = ({
  section,
  level = 0,
  onSelect,
  selectedId,
}) => {
  const hasChildren = section.children.length > 0
  const indent = level * 12 // Отступ для уровней вложенности
  const isSelected = selectedId === section.id

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

  return (
    <div className='gdoc-outline-item'>
      <div
        className={`py-1 cursor-pointer hover:bg-gray-100 rounded ${levelStyles} ${isSelected ? 'bg-blue-100 font-medium' : ''}`}
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
              dangerouslySetInnerHTML={{ __html: instruction.text }}
            />
          )}
          {instruction.children.length > 0 && (
            <Accordion type='multiple' className='ml-5'>
              {instruction.children.map(childInstruction => (
                <InstructionItem
                  key={childInstruction.id}
                  instruction={childInstruction}
                  id={`instruction-${childInstruction.id}`}
                  isSelected={selectedId === childInstruction.id}
                  selectedId={selectedId}
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
    const node = nodeMap.get(item.id)!
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

  const navigateToInstruction = useCallback(
    (id: number) => {
      const isRepeatedClick = selectedId === id

      if (isRepeatedClick) {
        setSelectedId(null)
      } else {
        setSelectedId(id)

        setTimeout(() => {
          setSelectedId(prev => (prev === id ? null : prev))
        }, 2000)
      }

      setTimeout(() => {
        const targetElement = document.getElementById(`instruction-${id}`)
        if (!targetElement) {
          return
        }

        const accordionItem = targetElement.closest('[data-state]')
        if (!accordionItem || !(accordionItem instanceof HTMLElement)) {
          return
        }

        const button = accordionItem.querySelector('button[data-state]')
        if (!button || !(button instanceof HTMLElement)) {
          return
        }

        if (isRepeatedClick) {
          button.click()
          return
        }

        const ancestorAccordions: HTMLElement[] = []
        let parent = accordionItem.parentElement

        while (parent) {
          const parentAccordion = parent.closest('[data-state]')
          if (
            parentAccordion &&
            parentAccordion instanceof HTMLElement &&
            parentAccordion !== accordionItem
          ) {
            ancestorAccordions.unshift(parentAccordion)
            parent = parentAccordion.parentElement
          } else {
            break
          }
        }

        for (const accordion of ancestorAccordions) {
          if (accordion.getAttribute('data-state') === 'closed') {
            const accordionButton = accordion.querySelector('button[data-state]')
            if (accordionButton && accordionButton instanceof HTMLElement) {
              accordionButton.click()
            }
          }
        }

        if (accordionItem.getAttribute('data-state') === 'closed') {
          button.click()
        }

        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }, 100)
    },
    [selectedId],
  )

  return (
    <PageLayout title='Instructions'>
      <div className='flex w-full mt-0'>
        <div className='flex-grow'>
          <Accordion type='multiple'>
            {finalInstructions.map(instruction => (
              <InstructionItem
                key={instruction.id}
                instruction={instruction}
                id={`instruction-${instruction.id}`}
                isSelected={selectedId === instruction.id}
                selectedId={selectedId}
              />
            ))}
          </Accordion>
        </div>

        <div
          className='w-64 shrink-0 bg-white border rounded-lg shadow-sm overflow-auto sm:block hidden ml-4'
          style={{ userSelect: 'none', marginTop: '0' }}
        >
          <div className='p-3 border-b bg-gray-50 sticky top-0 z-10'>
            <h3 className='text-lg font-medium'>Outline</h3>
          </div>

          <div className='p-2'>
            {finalInstructions.map(section => (
              <OutlineItem
                key={section.id}
                section={section}
                level={0}
                onSelect={navigateToInstruction}
                selectedId={selectedId}
              />
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
