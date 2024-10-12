import { Form } from "@remix-run/react";

interface InputProps {
  name: string;
  type: string;
}

function Input({ name, type }: InputProps) {
  return (
    <label htmlFor={name}>
      {name}: <input type={type} id={name} />
    </label>
  );
}

export default function Customer() {
  return (
    <main>
      <h1>Customer Management</h1>

      {/* <section className="customer-search">
        <input type="text" id="search" placeholder="Search customers..." />
        <ul id="searchResults"></ul>
      </section> */}

      <section className="customer-htmlForm">
        <h2 id="htmlFormTitle">Add New Customer</h2>
        <Form id="customerhtmlForm">
          <input type="hidden" id="customerId" />

          <Input name="Name" type="text" />
          <Input name="Email" type="email" />
          <Input name="Phone" type="tel" />
          <Input name="Address" type="text" />

          <button type="submit" id="submitBtn">
            Add Customer
          </button>
        </Form>
      </section>

      {/* <section className="customer-list">
        <h2>Customer List</h2>
        <ul id="customerList"></ul>
      </section> */}
    </main>
  );
}
