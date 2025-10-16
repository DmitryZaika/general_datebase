import type { TCustomerSchema } from '~/schemas/sales'
import type { Faucet, Sink } from '~/types'

export const roomPrice = (
  room: TCustomerSchema['rooms'][number],
  _sink_type: Sink[],
  _faucet_type: Faucet[],
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

  total += room.sink_type.reduce((acc, sink) => acc + Number(sink.price), 0)
  total += room.faucet_type.reduce((acc, faucet) => acc + Number(faucet.price), 0)

  return total
}

//New function
