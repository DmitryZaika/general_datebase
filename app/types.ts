export interface Todo {
  id: number;
  rich_text: string;
  is_done: number;
  position: number;
  created_date: string;
}

export interface InstructionSlim {
  id: number;
  title: string | null;
  rich_text: string;
}

export interface Instruction extends InstructionSlim {
  parent_id: number | null;
  after_id: number | null;
  children?: Instruction[];
}

export interface HeaderProps {
  user: object | null;
  isAdmin: boolean;
  isSuperUser: boolean;
  isEmployee?: boolean;
}

export interface TokenSet {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
  x_refresh_token_expires_in: number;
}

export interface Customer {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface StoneSearchResult {
  id: number;
  type: string;
  width: number;
  length: number;
  name: string;
  url: string;
  retail_price: number;
  cost_per_sqft: number;
  available: number;
  amount: number;
  is_display: boolean;
}
