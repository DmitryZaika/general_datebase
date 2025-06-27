import { LoaderFunctionArgs, data } from "react-router";
import { db } from "~/db.server";
import { getEmployeeUser } from "~/utils/session.server";
import { selectId } from "~/utils/queryHelpers";
import { RowDataPacket } from "mysql2";

interface Customer {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request);
  const customerId = params.customerId;
  
  if (!customerId) {
    return data({ error: "Customer ID is required" }, { status: 400 });
  }
  
  try {
    // Get customer details
    const [customer] = await db.query<(Customer & RowDataPacket)[]>(
      `SELECT id, name, address, phone, email, company_name 
       FROM customers 
       WHERE id = ? AND company_id = ?`,
      [customerId, user.company_id]
    );
    
    if (!customer || customer.length === 0) {
      return data({ error: "Customer not found" }, { status: 404 });
    }
    
    return data({ customer: customer[0] });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return data({ error: "Failed to fetch customer" }, { status: 500 });
  }
} 