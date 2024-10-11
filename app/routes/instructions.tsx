import ModuleList from "../components/ModuleList";

interface RemnantTextProps {
  children: JSX.Element;
}

function RemnantText({ children }: RemnantTextProps) {
  return (
    <li className="flex items-start">
      <span className="inline-block w-2 h-2 bg-black rounded-full mr-3 mt-1"></span>
      {children}
    </li>
  );
}

export default function Instrucitons() {
  return (
    <main>
      <h1>Instructions</h1>
      <section className="modules">
        <div className="module">
          <h2 className="module-title">Leading a customer</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"After Template"}>
                <p>
                  1. Check difference between customer sqft on the contract and
                  on the template. 2. If its a difference more then 1 sqft (For
                  example 0.99 we dont notife a customer, or 1 we notify a
                  customer) 3. send to Tanya [Name] extra 6 sqft, total 58 sqft
                  - $367 Sealer for 6 sqft - $36 Товар/услуга - кол-во sqft
                  (если нужно) - сумма
                </p>
              </ModuleList>

              <ModuleList name={"After Install"}>
                <p>
                  1. Call to the customer, ask about his experience Example
                  "Hello, [Client's Name]. I wanted to check in and see how the
                  installation went. Did everything meet your expectations, and
                  are you satisfied with the results? If you have any questions
                  or concerns, please let me know. Thank you!"
                </p>
              </ModuleList>

              <ModuleList name={"Before Template"}>
                <p>
                  Details about how to handle special or custom orders for
                  customers...
                </p>
              </ModuleList>
            </ul>
          </div>
        </div>
        <div className="module">
          <h2 className="module-title">Special Order</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"Custom order"}>
                <p>
                  Details about how to handle special or custom orders for
                  customers...
                </p>
              </ModuleList>
            </ul>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title">Discounts</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"Customers"}>
                <div /* className="discount-section" */>
                  <h2>Discounts</h2>
                  <p>
                    You can give these discounts to accommodate situations where
                    providing a discount could be a decisive factor in securing
                    a deal. As for the original price, please follow the prices
                    outlined in the inventory spreadsheet (updated more
                    frequently) or the pricelist.
                  </p>
                  <ul>
                    <li>
                      <strong>For granite and quartz</strong>, you can provide a
                      discount of up to $3 per sqft without confirmation.
                    </li>
                  </ul>
                  <p>
                    <strong>
                      ADDITIONALLY - You can give FINAL discount in the
                      following scenarios:
                    </strong>
                  </p>
                  <ul>
                    <li>
                      <strong>Contract amount $1200-$2000:</strong> You can give
                      a discount (up to $100) by rounding to the nearest hundred
                      without confirmation.
                    </li>
                    <li>
                      <em>Example:</em> You give a price of $1670 for a kitchen,
                      but the customer wants to do $1600 - you can do it. If
                      they are asking for $1500 - no, that would not work.
                    </li>
                    <li>
                      <strong>Contract amount $2000-$3500:</strong> You can give
                      a discount (up to $150) by rounding to the nearest hundred
                      without confirmation.
                    </li>
                    <li>
                      <em>Example:</em> You give a price of $2830 for a kitchen,
                      but the customer wants to do $2700 - you can do it. If
                      they are asking for $2650 - no, that would not work.
                    </li>
                    <li>
                      <strong>Contract amount $3500-$5000:</strong> You can give
                      a discount (up to $200) by rounding to the nearest hundred
                      without confirmation.
                    </li>
                    <li>
                      <em>Example:</em> You give a price of $4615 for a kitchen,
                      but the customer wants to do $4450 - you can do it. If
                      they are asking for $4400 - no, that would not work.
                    </li>
                    <li>
                      <strong>Contract amount $5000+:</strong> Discuss
                      additional discounts with George.
                    </li>
                  </ul>
                  <p>
                    <strong>Important Notes:</strong>
                  </p>
                  <ul>
                    <li>
                      These discounts <strong>ARE NOT</strong> to be applied to
                      any specials.
                    </li>
                    <li>
                      These discounts are not to be applied right away when you
                      tell the customer the price. They can be applied during
                      the price discussion and bargaining with customers. Do not
                      agree with a lower price that the customer names right
                      away, even when it fits the above-written conditions.
                    </li>
                    <li>
                      Please do not forget to charge a 3% card fee, especially
                      when discounts are given.
                    </li>
                    <li>
                      If a customer is buying a kitchen at full price without
                      discounts and strongly disagrees with a fee - you can
                      call/text George or Dasha to see if we can waive the fee.
                    </li>
                  </ul>
                </div>
              </ModuleList>
              <ModuleList name={"Builders"}>
                <div className="builder-discount-container">
                  <p className="builder-discount-text">Builder Discounts:</p>
                  <ul className="builder-discount-list">
                    <li>
                      <strong>
                        Quartz and Granite Colors (Levels 1, 2, 3):
                      </strong>
                      - $3 off per square foot
                    </li>
                    <li>
                      <strong>
                        Quartz and Granite Colors (Level 4 and above):
                      </strong>
                      - $5 off per square foot
                    </li>
                  </ul>

                  <p className="builder-discount-text">
                    Additional Sink & Cutout Charges:
                  </p>
                  <ul className="builder-discount-list">
                    <li>Sink cutouts (Farm Sink): $150</li>
                    <li>Stainless Steel regular sinks: $150</li>
                    <li>Sink cutouts for customer-provided sinks: $175</li>
                    <li>Cooktop cutout: $125</li>
                    <li>Vanity sink cutouts: $75</li>
                    <li>Small Radius/Zero Radius sinks: $300</li>
                    <li>Granite Composite sinks: $500</li>
                  </ul>

                  <p className="builder-discount-text">Sealer Offer:</p>
                  <ul className="builder-discount-list">
                    <li>
                      10-year sealer: $3 per square foot when purchased with
                      countertops
                    </li>
                  </ul>

                  <p className="builder-discount-text">Project Threshold:</p>
                  <ul className="builder-discount-list">
                    <li>
                      Projects exceeding $10,000 may be discussed separately
                      with George for potential additional discounts.
                    </li>
                  </ul>

                  <p className="builder-discount-text">Important Notes:</p>
                  <ul className="builder-discount-list">
                    <li>
                      These discounts ARE NOT to be applied to any specials.
                    </li>
                    <li>
                      These discounts are not to be applied immediately but
                      during price discussions.
                    </li>
                    <li>
                      Don't agree to the customer's initial lower price even if
                      it fits the conditions.
                    </li>
                    <li>
                      Don't forget to charge a 3% card fee when discounts are
                      applied.
                    </li>
                    <li>
                      If the builder strongly disagrees with the fee, contact
                      George or Dasha for approval.
                    </li>
                  </ul>

                  <p className="builder-discount-text">Deadlines:</p>
                  <ul className="builder-discount-list">
                    <li>
                      We can install builder’s project faster (5-7 days for
                      template and installation) but without additional
                      discounts.
                    </li>
                  </ul>

                  <p className="builder-discount-text">Example:</p>
                  <ul className="builder-discount-list">
                    <li>
                      Calacatta Laza is $80, for builder - $75. You quote the
                      kitchen at $5200:
                    </li>
                    <ul className="builder-discount-list">
                      <li>
                        If the builder is not rushing but asks for $5K - yes,
                        you can reduce the price to $5000.
                      </li>
                      <li>
                        If the builder needs ASAP installation, the price
                        remains $5200. "ASAP" and "Discount" do not work
                        together.
                      </li>
                    </ul>
                  </ul>
                </div>
              </ModuleList>
            </ul>
          </div>
        </div>
        <div className="module">
          <h2 className="module-title">Layout</h2>
          <div className="dropdown-content">
            <p>
              <strong>Follow these steps for layout creation:</strong>
            </p>
            <p>
              <strong>1.</strong> Upload a slab image in Timetree showing piece
              placement. The final countertop image is not helpful.
            </p>
            <div className="special-order_images">
              <div>
                <img
                  className="commission-img"
                  src="./Images/layout/layout_correct.webp"
                  alt=""
                />
                <p>👍🏼✅</p>
              </div>
              <div>
                <img
                  className="commission-img"
                  src="./Images/layout/layout_incorrect.webp"
                  alt=""
                />
                <p>👎🏼❌</p>
              </div>
            </div>
            <p>
              <strong>2.</strong> Label each piece, marking front/back, and
              indicate in Timetree's comments which slab is used.
            </p>
            <p>
              <strong>3.</strong> Maximize material use: cut from the top and
              avoid edges.
            </p>
            <p>
              <strong>4.</strong> Mark on the paperwok Layout:yes
            </p>
            <h3 style={{ textAlign: "center", padding: "20px 0 20px 0" }}>
              Main Rules
            </h3>
            <ul>
              <li>
                <p>
                  1. The layout should be completed the day after the template
                  is created, or when the slab arrives.
                  <strong>
                    If a sales representative is on vacation or unavailable to
                    create the layout, they must ask the shop manager or another
                    sales representative to handle it.
                  </strong>
                </p>
              </li>
              <li>
                <p>
                  2. The template specialist must provide an estimate for the
                  full-height backsplash during the initial template
                  appointment.
                  <strong>
                    It is the sales representative's responsibility to verify
                    the estimate after the template is completed.
                  </strong>
                </p>
              </li>
            </ul>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title">Selling Steps</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"Walk in"}>
                <p>
                  How to approach and communicate with the customer during the
                  first contact...
                </p>
              </ModuleList>
              <ModuleList name={"Lead"}>
                <p>
                  Techniques for presenting products and highlighting key
                  benefits...
                </p>
              </ModuleList>
              <ModuleList name={"Closing"}>
                <p>
                  Strategies to close the sale and ensure customer
                  satisfaction...
                </p>
              </ModuleList>
            </ul>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title">Responsibilities</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"Customer Comunications"}>
                <p>
                  Guidelines for clear and effective communication with
                  customers...
                </p>
              </ModuleList>
              <ModuleList name={"Order Accuracy"}>
                <p>
                  Ensure all orders and customer data are processed
                  accurately...
                </p>
              </ModuleList>
              <ModuleList name={"Timely Delivery"}>
                <p>
                  Adhering to deadlines and making sure orders are delivered on
                  time...
                </p>
              </ModuleList>
            </ul>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title text-2xl font-bold">Commission</h2>
          <div className="dropdown-content">
            <ul>
              <li className="module-list">
                <h3 className="mb-6">
                  For the jobs sold after 1/1/24 we will have updated
                  commission:
                </h3>
                <ul className="mb-4">
                  <li className="bold-text">
                    ● Level 1 & 2 stones - the commission is 3%
                  </li>
                  <li className="bold-text">● Level 3 or above - 5%</li>
                  <li className="bold-text">● Remnants - 7%</li>
                </ul>
                <p className="text-lg mb-6">
                  In case the job is mixed: kitchen - level 4 quartz, vanity -
                  level 1 granite, then please put them separately in your
                  commission sheet:
                </p>
                <img
                  src="./images/commission/sales_commission_list.webp"
                  alt="Commission Sheet"
                  className="commission-img w-full max-w-lg mx-auto mb-6"
                />

                <h2 className="text-xl font-bold my-4">Bonuses:</h2>
                <ul className="mb-4 text-2x1">
                  <li className="bold-text">
                    ➢ In case your sales per month reach $50,000 - you are
                    getting a bonus of $500
                  </li>
                  <li className="bold-text">
                    ➢ In case your sales per month reach $75,000 - you are
                    getting a bonus of $750
                  </li>
                  <li className="bold-text">
                    ➢ In case your sales per month reach $100,000 - you are
                    getting a bonus of $1000
                  </li>
                </ul>
                <div className="text-lg mb-6">
                  <p>
                    * The sales target must be $50,000, not $49,750. If someone
                    cancels the job - it is deducted from the sales target.
                  </p>
                  <p>
                    * In the event of a challenging situation or disagreement
                    with a customer, we will do an individual examination of the
                    commission payment aspect.
                  </p>
                  <p>
                    * Bonus is paid the following week after the end of the
                    month.
                  </p>
                  <p className="mb-5">
                    * These conditions apply for January and February, after
                    that something might change.
                  </p>
                </div>
                <img
                  src="./images/commission/sales_commission_calendar.webp"
                  alt="Sales Commission Calendar"
                  className="commission-img w-full max-w-lg mx-auto mb-6"
                />
                <h3 className="text-xl">
                  ➢ Sealer commission remains the same - $1/sqft of sealer sold
                </h3>
              </li>
            </ul>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title">Remnants</h2>
          <div className="dropdown-content">
            <div className="p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">
                Remnants Policy and Procedure
              </h2>
              <ul className="list-none space-y-4">
                <RemnantText>
                  <p>
                    <strong>Minimum Price:</strong> Remnants start at $35 per
                    square foot.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Price per Square Foot:</strong> The price for
                    remnants is determined by subtracting $20 from the standard
                    price of the specific color.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Sales Commission:</strong> Sales representatives
                    will receive a 7% commission from the total sale.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Remnant Marking:</strong> After a sale, make sure to
                    mark the remnant as sold.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Minimum Order for Pick-up:</strong> Orders for
                    remnants must be a minimum of $350.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Condition of Sale:</strong> Remnants are sold as-is
                    and must be inspected by the customer before purchase. If
                    the customer is purchasing remotely, the salesperson must
                    inspect the remnant on their behalf.
                  </p>
                </RemnantText>
                <RemnantText>
                  <p>
                    <strong>Project Size Check:</strong> Sales representatives
                    must double-check the remnant's size to ensure it covers the
                    entire project, including backsplash.
                  </p>
                </RemnantText>
              </ul>
            </div>
          </div>
        </div>

        <div className="module">
          <h2 className="module-title">Objections</h2>
          <div className="dropdown-content">
            <ul>
              <ModuleList name={"Custom order"}>
                <p>
                  Details about how to handle special or custom orders for
                  customers...
                </p>
              </ModuleList>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
