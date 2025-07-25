import { Form } from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface IProps {
  handleChange: (open: boolean) => void
  title: string
  description: string
  intent?: string
  id?: number
  onSubmit?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export const DeleteRow = ({
  handleChange,
  title,
  description,
  intent,
  id,
  onSubmit,
}: IProps) => {
  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form id='customerForm' method='post'>
          <DialogFooter>
            <AuthenticityTokenInput />
            {intent && <input type='hidden' name='intent' value={intent} />}
            {id && <input type='hidden' name='id' value={id} />}
            <Button autoFocus type='submit' variant='destructive' onClick={onSubmit}>
              Confirm
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
