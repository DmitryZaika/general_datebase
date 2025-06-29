import type { TCustomerSchema } from '~/schemas/sales'
import type { Faucet, Sink } from '~/types'

export const roomPrice = (
  room: TCustomerSchema['rooms'][number],
  sink_type: Sink[],
  faucet_type: Faucet[],
) => {
  let total = (room.square_feet || 0) * (room.retail_price || 0)
  for (const extra of Object.values(room.extras)) {
    total += typeof extra === 'number' ? extra : extra?.price || 0
  }

  for (const sink of room.sink_type) {
    total += Number(sink_type.find(s => s.id === sink.id)?.retail_price || 0)
  }

  for (const faucet of room.faucet_type) {
    total += Number(faucet_type.find(f => f.id === faucet.id)?.retail_price || 0)
  }
  return total
}

//New function
