import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { PageLayout } from "~/components/PageLayout";

export default function Instructions() {
  return (
    <PageLayout title="Instructions">
      <Accordion type="multiple">
        {/* Leading a Customer */}
        <AccordionItem value="leading-customer">
          <AccordionTrigger>Leading a Customer</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* After Template */}
              <AccordionItem value="after-template">
                <AccordionTrigger>After Template</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    1. Check difference between customer sqft on the contract
                    and on the template.
                    <br />
                    2. If it&apos;s a difference more than 1 sqft (For example,
                    0.99 we don&apos;t notify a customer, or 1 we notify a
                    customer).
                    <br />
                    3. Send to Tanya [Name] extra 6 sqft, total 58 sqft - $367
                    Sealer for 6 sqft - $36 Товар/услуга - кол-во sqft (если
                    нужно) - сумма.
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* After Install */}
              <AccordionItem value="after-install">
                <AccordionTrigger>After Install</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    1. Call to the customer, ask about their experience.
                    <br />
                    Example: &quot;Hello, [Client&apos;s Name]. I wanted to
                    check in and see how the installation went. Did everything
                    meet your expectations, and are you satisfied with the
                    results? If you have any questions or concerns, please let
                    me know. Thank you!&quot;
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Before Template */}
              <AccordionItem value="before-template">
                <AccordionTrigger>Before Template</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Details about how to handle special or custom orders for
                    customers...
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Special Order */}
        <AccordionItem value="special-order">
          <AccordionTrigger>Special Order</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* Custom Order */}
              <AccordionItem value="custom-order">
                <AccordionTrigger>Custom Order</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Details about how to handle special or custom orders for
                    customers...
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Fabrication */}
              <AccordionItem value="fabrication">
                <AccordionTrigger>Fabrication</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Granite: $60 per sqft
                    <br />
                    Quartz: $70 per sqft
                    <br />
                    Porcelain: $70 per sqft
                    <br />
                    Quartzite: $80 per sqft
                    <br />
                    Marble: $80 per sqft
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Discounts */}
        <AccordionItem value="discounts">
          <AccordionTrigger>Discounts</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* Customers */}
              <AccordionItem value="customers">
                <AccordionTrigger>Customers</AccordionTrigger>
                <AccordionContent>
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Discounts</h2>
                    <p className="mb-4">
                      You can give these discounts to accommodate situations
                      where providing a discount could be a decisive factor in
                      securing a deal. As for the original price, please follow
                      the prices outlined in the inventory spreadsheet (updated
                      more frequently) or the price list.
                    </p>
                    <ul className="list-disc list-inside mb-4">
                      <li>
                        <strong>For granite and quartz</strong>, you can provide
                        a discount of up to $3 per sqft without confirmation.
                      </li>
                    </ul>
                    <p className="font-bold mb-4">
                      ADDITIONALLY - You can give FINAL discount in the
                      following scenarios:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        <strong>Contract amount $1200-$2000:</strong> You can
                        give a discount (up to $100) by rounding to the nearest
                        hundred without confirmation.
                        <br />
                        <em>
                          Example: You give a price of $1670 for a kitchen, but
                          the customer wants to do $1600 - you can do it. If
                          they are asking for $1500 - no, that would not work.
                        </em>
                      </li>
                      <li>
                        <strong>Contract amount $2000-$3500:</strong> You can
                        give a discount (up to $150) by rounding to the nearest
                        hundred without confirmation.
                        <br />
                        <em>
                          Example: You give a price of $2830 for a kitchen, but
                          the customer wants to do $2700 - you can do it. If
                          they are asking for $2650 - no, that would not work.
                        </em>
                      </li>
                      <li>
                        <strong>Contract amount $3500-$5000:</strong> You can
                        give a discount (up to $200) by rounding to the nearest
                        hundred without confirmation.
                        <br />
                        <em>
                          Example: You give a price of $4615 for a kitchen, but
                          the customer wants to do $4450 - you can do it. If
                          they are asking for $4400 - no, that would not work.
                        </em>
                      </li>
                      <li>
                        <strong>Contract amount $5000+:</strong> Discuss
                        additional discounts with George.
                      </li>
                    </ul>
                    <p className="font-bold mt-6 mb-2">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        These discounts <strong>ARE NOT</strong> to be applied
                        to any specials.
                      </li>
                      <li>
                        These discounts are not to be applied right away when
                        you tell the customer the price. They can be applied
                        during the price discussion and bargaining with
                        customers. Do not agree with a lower price that the
                        customer names right away, even when it fits the
                        above-written conditions.
                      </li>
                      <li>
                        Please do not forget to charge a 3% card fee, especially
                        when discounts are given.
                      </li>
                      <li>
                        If a customer is buying a kitchen at full price without
                        discounts and strongly disagrees with a fee - you can
                        call/text George or Dasha to see if we can waive the
                        fee.
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Builders */}
              <AccordionItem value="builders">
                <AccordionTrigger>Builders</AccordionTrigger>
                <AccordionContent>
                  <div className="bg-gray-50 p-4 rounded-md mt-4">
                    <p className="font-bold underline mb-2">
                      Builder Discounts:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        <strong>
                          Quartz and Granite Colors (Levels 1, 2, 3):
                        </strong>{" "}
                        - $3 off per square foot
                      </li>
                      <li>
                        <strong>
                          Quartz and Granite Colors (Level 4 and above):
                        </strong>{" "}
                        - $5 off per square foot
                      </li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">
                      Additional Sink &amp; Cutout Charges:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>Sink cutouts (Farm Sink): $150</li>
                      <li>Stainless Steel regular sinks: $150</li>
                      <li>Sink cutouts for customer-provided sinks: $175</li>
                      <li>Cooktop cutout: $125</li>
                      <li>Vanity sink cutouts: $75</li>
                      <li>Small Radius/Zero Radius sinks: $300</li>
                      <li>Granite Composite sinks: $500</li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">
                      Sealer Offer:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        10-year sealer: $3 per square foot when purchased with
                        countertops
                      </li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">
                      Project Threshold:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        Projects exceeding $10,000 may be discussed separately
                        with George for potential additional discounts.
                      </li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">
                      Important Notes:
                    </p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        These discounts ARE NOT to be applied to any specials.
                      </li>
                      <li>
                        These discounts are not to be applied immediately but
                        during price discussions.
                      </li>
                      <li>
                        Don&apos;t agree to the customer&apos;s initial lower
                        price even if it fits the conditions.
                      </li>
                      <li>
                        Don&apos;t forget to charge a 3% card fee when discounts
                        are applied.
                      </li>
                      <li>
                        If the builder strongly disagrees with the fee, contact
                        George or Dasha for approval.
                      </li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">Deadlines:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        We can install builder&apos;s projects faster (5-7 days
                        for template and installation) but without additional
                        discounts.
                      </li>
                    </ul>

                    <p className="font-bold underline mt-4 mb-2">Example:</p>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        Calacatta Laza is $80, for builder - $75. You quote the
                        kitchen at $5200:
                        <ul className="list-disc list-inside ml-5 mt-2 space-y-2">
                          <li>
                            If the builder is not rushing but asks for $5K -
                            yes, you can reduce the price to $5000.
                          </li>
                          <li>
                            If the builder needs ASAP installation, the price
                            remains $5200. &quot;ASAP&quot; and
                            &quot;Discount&quot; do not work together.
                          </li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Layout */}
        <AccordionItem value="layout">
          <AccordionTrigger>Layout</AccordionTrigger>
          <AccordionContent>
            <p className="font-bold">Follow these steps for layout creation:</p>
            <p className="mt-2">
              <strong>1.</strong> Upload a slab image in Timetree showing piece
              placement. The final countertop image is not helpful.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="text-center">
                <img
                  className="w-full max-w-xs mx-auto"
                  src="./Images/layout/layout_correct.webp"
                  alt="Correct Layout"
                />
                <p className="mt-2">👍🏼✅</p>
              </div>
              <div className="text-center">
                <img
                  className="w-full max-w-xs mx-auto"
                  src="./Images/layout/layout_incorrect.webp"
                  alt="Incorrect Layout"
                />
                <p className="mt-2">👎🏼❌</p>
              </div>
            </div>
            <p className="mt-4">
              <strong>2.</strong> Label each piece, marking front/back, and
              indicate in Timetree&apos;s comments which slab is used.
            </p>
            <p className="mt-2">
              <strong>3.</strong> Maximize material use: cut from the top and
              avoid edges.
            </p>
            <p className="mt-2">
              <strong>4.</strong> Mark on the paperwork Layout: yes
            </p>
            <h3 className="text-center text-xl font-semibold my-6">
              Main Rules
            </h3>
            <ul className="list-decimal list-inside space-y-4">
              <li>
                The layout should be completed the day after the template is
                created, or when the slab arrives.{" "}
                <strong>
                  If a sales representative is on vacation or unavailable to
                  create the layout, they must ask the shop manager or another
                  sales representative to handle it.
                </strong>
              </li>
              <li>
                The template specialist must provide an estimate for the
                full-height backsplash during the initial template appointment.{" "}
                <strong>
                  It is the sales representative&apos;s responsibility to verify
                  the estimate after the template is completed.
                </strong>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        {/* Selling Steps */}
        <AccordionItem value="selling-steps">
          <AccordionTrigger>Selling Steps</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* Walk In */}
              <AccordionItem value="walk-in">
                <AccordionTrigger>Walk In</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    How to approach and communicate with the customer during the
                    first contact...
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Lead */}
              <AccordionItem value="lead">
                <AccordionTrigger>Lead</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Techniques for presenting products and highlighting key
                    benefits...
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Closing */}
              <AccordionItem value="closing">
                <AccordionTrigger>Closing</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Strategies to close the sale and ensure customer
                    satisfaction...
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Responsibilities */}
        <AccordionItem value="responsibilities">
          <AccordionTrigger>Responsibilities</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* Customer Communications */}
              <AccordionItem value="customer-communications">
                <AccordionTrigger>Customer Communications</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Guidelines for clear and effective communication with
                    customers...
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Order Accuracy */}
              <AccordionItem value="order-accuracy">
                <AccordionTrigger>Order Accuracy</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Ensure all orders and customer data are processed
                    accurately...
                  </p>
                </AccordionContent>
              </AccordionItem>
              {/* Timely Delivery */}
              <AccordionItem value="timely-delivery">
                <AccordionTrigger>Timely Delivery</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Adhering to deadlines and making sure orders are delivered
                    on time...
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>

        {/* Commission */}
        <AccordionItem value="commission">
          <AccordionTrigger>Commission</AccordionTrigger>
          <AccordionContent>
            {/* Content from the Commission module */}
            {/* Copy the content from your original code here */}
          </AccordionContent>
        </AccordionItem>

        {/* Remnants */}
        <AccordionItem value="remnants">
          <AccordionTrigger>Remnants</AccordionTrigger>
          <AccordionContent>
            <div className="p-6 rounded-lg shadow-lg bg-gray-50">
              <h2 className="text-xl font-semibold mb-4">
                Remnants Policy and Procedure
              </h2>
              <ul className="list-none space-y-4">
                {/* Replace RemnantText component with list items */}
                <li className="flex items-start">
                  <span className="inline-block w-2 h-2 bg-black rounded-full mr-3 mt-1"></span>
                  <p>
                    <strong>Minimum Price:</strong> Remnants start at $35 per
                    square foot.
                  </p>
                </li>
                {/* Continue with other list items similarly */}
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Objections */}
        <AccordionItem value="objections">
          <AccordionTrigger>Objections</AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple">
              {/* Custom Order */}
              <AccordionItem value="custom-order-objections">
                <AccordionTrigger>Custom Order</AccordionTrigger>
                <AccordionContent>
                  <p className="mt-2">
                    Details about how to handle special or custom orders for
                    customers...
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageLayout>
  );
}
