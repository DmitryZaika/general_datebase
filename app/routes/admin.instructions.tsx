import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import {
  Link,
  type LoaderFunctionArgs,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import '~/styles/instructions.css'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface Instructions {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
}

interface InstructionNode {
  id: number
  title: string
  parent_id: number | null
  after_id: number | null
  rich_text: string
  children: InstructionNode[]
}

interface InstructionItemProps {
  instruction: InstructionNode
  onEdit: (id: number) => void
  onDelete: (id: number) => void
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  const user = await getAdminUser(request)
  const instructions = await selectMany<Instructions>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text FROM instructions WHERE company_id = ?',
    [user.company_id],
  )
  return { instructions }
}

function buildInstructionTree(instructions: Instructions[]): InstructionNode[] {
  const nodeMap = new Map<number, InstructionNode>()

  instructions.forEach(item => {
    nodeMap.set(item.id, {
      ...item,
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
    if (!node) return

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

const InstructionItem: FC<InstructionItemProps> = ({ instruction, onEdit, onDelete }) => {
  const hasChildren = instruction.children.length > 0
  const hasTitle = Boolean(instruction.title)

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(instruction.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(instruction.id)
  }

  if (hasTitle) {
    return (
      <AccordionItem value={instruction.id.toString()} className='border-b border-gray-200 last:border-b-0'>
        <AccordionTrigger className='py-5 px-6 [&[data-state=open]_h3]:underline [&[data-state=open]_h3]:underline-offset-4'>
          <div className='flex items-center justify-between flex-1 gap-6'>
            <h3 className='font-bold text-2xl text-gray-900 text-left'>
              {instruction.title}
            </h3>
            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                onClick={handleEdit}
                className='p-2 rounded-md transition-colors'
                aria-label='Edit instruction'
                title='Edit instruction'
              >
                <Pencil className='w-4 h-4 text-gray-600 hover:text-blue-600 transition-colors' />
              </button>
              <button
                type='button'
                onClick={handleDelete}
                className='p-2 rounded-md transition-colors'
                aria-label='Delete instruction'
                title='Delete instruction'
              >
                <Trash2 className='w-4 h-4 text-gray-600 hover:text-red-600 transition-colors' />
              </button>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className='ml-6 border-l-1 border-blue-200 pl-4'>
            <article
              className='prose prose-base max-w-none instructions px-6 py-5 bg-gray-50 rounded-lg shadow-md'
              dangerouslySetInnerHTML={{ __html: instruction.rich_text }}
            />
            {hasChildren && (
              <section className='mt-6'>
                <Accordion type='multiple' className='space-y-3'>
                  {instruction.children.map(child => (
                    <InstructionItem
                      key={child.id}
                      instruction={child}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </Accordion>
              </section>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    )
  }

  return (
    <div className='ml-6 border-l-1 border-blue-200 pl-4'>
      <article className='py-5 px-6 bg-gray-50 rounded-lg shadow-md'>
        <div className='flex items-start justify-between gap-6'>
          <div
            className='prose prose-base max-w-none instructions flex-1'
            dangerouslySetInnerHTML={{ __html: instruction.rich_text }}
          />
          <div className='flex items-center gap-3 shrink-0'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onEdit(instruction.id)
              }}
              className='p-2 rounded-md transition-colors'
              aria-label='Edit instruction'
              title='Edit instruction'
            >
              <Pencil className='w-5 h-5 text-gray-600 hover:text-blue-600 transition-colors' />
            </button>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation()
                onDelete(instruction.id)
              }}
              className='p-2 rounded-md transition-colors'
              aria-label='Delete instruction'
              title='Delete instruction'
            >
              <Trash2 className='w-5 h-5 text-gray-600 hover:text-red-600 transition-colors' />
            </button>
          </div>
        </div>
        {hasChildren && (
          <section className='mt-6 space-y-3'>
            {instruction.children.map(child => (
              <InstructionItem
                key={child.id}
                instruction={child}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </section>
        )}
      </article>
    </div>
  )
}

export default function AdminInstructions() {
  const { instructions } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const instructionTree = buildInstructionTree(instructions)

  const filteredTree = instructionTree.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleEdit = (id: number) => {
    navigate(`edit/${id}`)
  }

  const handleDelete = (id: number) => {
    navigate(`delete/${id}`)
  }

  return (
    <PageLayout title='Instructions'>
      <header className='flex gap-4 justify-between mb-6'>
        <Link to='add' relative='path'>
          <Button size='lg' className='gap-2 shadow-sm hover:shadow-md transition-shadow'>
            <Plus className='w-5 h-5' />
            Add Instruction
          </Button>
        </Link>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search instructions...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='pl-8'
          />
        </div>
      </header>

      {filteredTree.length === 0 ? (
        <section className='flex flex-col items-center justify-center py-16 px-4'>
          <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
            <Search className='w-8 h-8 text-gray-400' />
          </div>
          <h2 className='text-lg font-medium text-gray-700 mb-2'>
            {searchTerm ? 'No instructions found' : 'No instructions yet'}
          </h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>
            {searchTerm
              ? 'Try adjusting your search terms or clear the search to see all instructions.'
              : 'Get started by creating your first instruction to help guide your team.'}
          </p>
          {!searchTerm && (
            <Link to='add' relative='path' className='mt-6'>
              <Button size='lg' className='gap-2'>
                <Plus className='w-5 h-5' />
                Create First Instruction
              </Button>
            </Link>
          )}
        </section>
      ) : (
        <section>
          <Accordion type='multiple' className='w-full space-y-2'>
            {filteredTree.map(instruction => (
              <InstructionItem
                key={instruction.id}
                instruction={instruction}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </Accordion>
        </section>
      )}
      <Outlet />
    </PageLayout>
  )
}
