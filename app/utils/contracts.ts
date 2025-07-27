import type { TCustomerSchema } from '~/schemas/sales'
import type { Faucet, Sink } from '~/types'

export const roomPrice = (
  room: TCustomerSchema['rooms'][number],
  sink_type: Sink[],
  faucet_type: Faucet[],
) => {
  let total = (room.square_feet || 0) * (room.retail_price || 0)
  for (const extra of Object.values(room.extras)) {
    if (!extra) continue
    if (!['number', 'string', 'object'].includes(typeof extra)) {
      throw new Error('Invalid extra type')
    }
    total += {
      number: Number(extra),
      string: Number(extra),
      object: Number((extra as { price: number }).price || 0),
    }[typeof extra as 'number' | 'string' | 'object']
  }

  for (const sink of room.sink_type) {
    total += Number(sink_type.find(s => s.id === sink.type_id)?.retail_price || 0)
  }

  for (const faucet of room.faucet_type) {
    total += Number(faucet_type.find(f => f.id === faucet.type_id)?.retail_price || 0)
  }
  return total
}

//New function
