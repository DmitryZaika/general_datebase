import { Button } from '~/components/ui/button'
import {
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  DialogHeader as UiDialogHeader,
  DialogTitle as UiDialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'

export interface RoomOption {
  id: string
  name: string
  roomUuid: string | null
}

interface StoneOption {
  id: number
  name: string
  url: string | null
}

interface SlabOption {
  id: number
  bundle: string
  parent_id?: number | null
  child_count?: number
}

interface AddSlabDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  addRoom: RoomOption | null
  allRooms: RoomOption[]
  addSearch: string
  setAddSearch: (value: string) => void
  addLoading: boolean
  addStones: StoneOption[]
  addStoneId: number | null
  onSelectStone: (id: number) => void
  addSlabs: SlabOption[]
  addSlabsLoading: boolean
  onSelectSlab: (id: number) => void
  onSelectRoom: (room: RoomOption) => void
}

export function AddSlabDialog({
  open,
  onOpenChange,
  addRoom,
  allRooms,
  addSearch,
  setAddSearch,
  addLoading,
  addStones,
  addStoneId,
  onSelectStone,
  addSlabs,
  addSlabsLoading,
  onSelectSlab,
  onSelectRoom,
}: AddSlabDialogProps) {
  return (
    <UiDialog open={open} onOpenChange={onOpenChange}>
      <UiDialogContent className='max-w-3xl'>
        <UiDialogHeader>
          <UiDialogTitle>Add Slab</UiDialogTitle>
        </UiDialogHeader>
        <div className='space-y-4'>
          {!addRoom ? (
            <div className='space-y-2'>
              <div className='text-sm font-medium'>Select room</div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                {allRooms.map(room => (
                  <Button
                    key={room.id}
                    variant='outline'
                    className='justify-start'
                    onClick={() => onSelectRoom(room)}
                  >
                    {room.name.charAt(0).toUpperCase() + room.name.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className='text-sm text-muted-foreground'>
                Room: {addRoom.name.charAt(0).toUpperCase() + addRoom.name.slice(1)}
              </div>
              <Input
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder='Search stones'
              />
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='border rounded p-2 max-h-80 overflow-y-auto'>
                  {addLoading ? (
                    <div className='p-2 text-sm'>Loading...</div>
                  ) : addStones.length === 0 ? (
                    <div className='p-2 text-sm'>No stones</div>
                  ) : (
                    addStones.map(stone => (
                      <div
                        key={stone.id}
                        className={`p-2 border-b last:border-b-0 cursor-pointer ${
                          stone.id === addStoneId ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => onSelectStone(stone.id)}
                      >
                        <div className='font-medium'>{stone.name}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className='border rounded p-2 max-h-80 overflow-y-auto'>
                  {addSlabsLoading ? (
                    <div className='p-2 text-sm'>Loading slabs...</div>
                  ) : addSlabs.length === 0 ? (
                    <div className='p-2 text-sm'>No slabs</div>
                  ) : (
                    addSlabs.map(slab => (
                      <div
                        key={slab.id}
                        className='p-2 border-b last:border-b-0 cursor-pointer hover:bg-blue-50'
                        onClick={() => onSelectSlab(slab.id)}
                      >
                        <div className='font-medium'>
                          Bundle {slab.bundle}
                          {slab.parent_id ? ' (Partial)' : ''}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {(() => {
                            const isPartial =
                              slab.parent_id !== null && slab.parent_id !== undefined
                                ? true
                                : (slab.child_count ?? 0) > 0
                            const statuses = [isPartial ? 'Partial' : 'Full']
                            return statuses.join(' • ')
                          })()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </UiDialogContent>
    </UiDialog>
  )
}
