export interface SaleDetails {
  id: number
  customer_id: number
  customer_name: string
  sale_date: string
  seller_id: number
  seller_name: string
  project_address: string | null
}

export interface SaleSlab {
  id: number
  stone_id: number
  bundle: string
  stone_name: string
  cut_date: string | null
  notes: string | null
  square_feet: number | null
  length?: number | null
  width?: number | null
  price?: number | null
  room: string | null
  room_uuid?: string | null
  parent_id: number | null
  child_count: number
}

export interface SaleSink {
  id: number
  sink_type_id: number
  name: string
  price: number
  is_deleted: number
  slab_id: number
  room: string | null
  room_uuid?: string | null
}
