import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  type LoaderFunctionArgs,
  Link,
  Outlet,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser } from '~/utils/session.server'

interface EmailTemplate {
  id: number
  template_name: string
  created_at: string
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const companyId = user.company_id

  const templates = await selectMany<EmailTemplate>(
    db,
    `SELECT id, template_name, created_at
     FROM email_templates
     WHERE company_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [companyId],
  )

  return { templates }
}

export default function ManageEmailTemplates() {
  const { templates } = useLoaderData<typeof loader>()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const handleChange = (open: boolean) => {
    if (!open) {
      navigate('..')
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.template_name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      <Dialog open={true} onOpenChange={handleChange}>
        <DialogContent className='sm:max-w-[700px] h-[500px] flex flex-col'>
          <DialogHeader>
            <DialogTitle>Manage Email Templates</DialogTitle>
          </DialogHeader>

          <div className='flex items-center gap-4 mb-4'>
            <Input
              placeholder='Search templates...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='flex-1'
            />
            <Link to='add'>
              <Button>
                <Plus className='w-4 h-4 mr-2' />
                Add New Template
              </Button>
            </Link>
          </div>

          <div className='flex-1 overflow-auto'>
            {!filteredTemplates.length ? (
              <div className='flex items-center justify-center h-full text-gray-500'>
                {searchTerm ? 'No templates found' : 'No templates yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead className='w-[100px]'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell className='font-medium'>
                        {template.template_name}
                      </TableCell>
                      <TableCell>{formatDate(template.created_at)}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <Link to={`edit/${template.id}`}>
                            <Button variant='ghost' size='icon'>
                              <Pencil className='w-4 h-4' />
                            </Button>
                          </Link>
                          <Link to={`delete/${template.id}`}>
                            <Button variant='ghost' size='icon'>
                              <Trash2 className='w-4 h-4 text-red-500' />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Outlet />
    </>
  )
}
