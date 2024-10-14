// Instructions.tsx
import { useState } from "react";
import ModuleList from "../components/ModuleList";
import { Title } from "../components/Title";
import BlockList from "~/components/BlockList";
import { PageLayout } from "~/components/PageLayout";

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

export default function Instructions() {
  // Создаем состояния для каждого модуля
  const [leadingCustomerOpen, setLeadingCustomerOpen] = useState(false);
  const [specialOrderOpen, setSpecialOrderOpen] = useState(false);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [sellingStepsOpen, setSellingStepsOpen] = useState(false);
  const [responsibilitiesOpen, setResponsibilitiesOpen] = useState(false);
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [remnantsOpen, setRemnantsOpen] = useState(false);
  const [objectionsOpen, setObjectionsOpen] = useState(false);

  return (
    <PageLayout title="Instructions">
      <Title
        text="Leading a Customer"
        state={leadingCustomerOpen}
        setState={setLeadingCustomerOpen}
      >
        <BlockList>
          <ModuleList name="After Template">
            <p className="mt-2">
              1. Check difference between customer sqft on the contract and on
              the template.
              <br />
              2. If it&apos;s a difference more than 1 sqft (For example, 0.99
              we don&apos;t notify a customer, or 1 we notify a customer).
              <br />
              3. Send to Tanya [Name] extra 6 sqft, total 58 sqft - $367 Sealer
              for 6 sqft - $36 Товар/услуга - кол-во sqft (если нужно) - сумма.
            </p>
          </ModuleList>

          <ModuleList name="After Install">
            <p className="mt-2">
              1. Call to the customer, ask about their experience.
              <br />
              Example: &quot;Hello, [Client&apos;s Name]. I wanted to check in
              and see how the installation went. Did everything meet your
              expectations, and are you satisfied with the results? If you have
              any questions or concerns, please let me know. Thank you!&quot;
            </p>
          </ModuleList>

          <ModuleList name="Before Template">
            <p className="mt-2">
              Details about how to handle special or custom orders for
              customers...
            </p>
          </ModuleList>
        </BlockList>
      </Title>

      {/* Special Order Module */}
      <Title
        text="Special Order"
        state={specialOrderOpen}
        setState={setSpecialOrderOpen}
      >
        <BlockList>
          <ModuleList name="Custom Order">
            <p className="mt-2">
              Details about how to handle special or custom orders for
              customers...
            </p>
          </ModuleList>
        </BlockList>
      </Title>

      {/* Discounts Module */}
      <Title text="Discounts" state={discountsOpen} setState={setDiscountsOpen}>
        <BlockList>
          <ModuleList name="Customers">
            <div>
              <h2 className="text-lg font-semibold mb-4">Discounts</h2>
              <p className="mb-4">
                You can give these discounts to accommodate situations where
                providing a discount could be a decisive factor in securing a
                deal. As for the original price, please follow the prices
                outlined in the inventory spreadsheet (updated more frequently)
                or the price list.
              </p>
              <ul className="list-disc list-inside mb-4">
                <li>
                  <strong>For granite and quartz</strong>, you can provide a
                  discount of up to $3 per sqft without confirmation.
                </li>
              </ul>
              <p className="font-bold mb-4">
                ADDITIONALLY - You can give FINAL discount in the following
                scenarios:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Contract amount $1200-$2000:</strong> You can give a
                  discount (up to $100) by rounding to the nearest hundred
                  without confirmation.
                  <br />
                  <em>
                    Example: You give a price of $1670 for a kitchen, but the
                    customer wants to do $1600 - you can do it. If they are
                    asking for $1500 - no, that would not work.
                  </em>
                </li>
                <li>
                  <strong>Contract amount $2000-$3500:</strong> You can give a
                  discount (up to $150) by rounding to the nearest hundred
                  without confirmation.
                  <br />
                  <em>
                    Example: You give a price of $2830 for a kitchen, but the
                    customer wants to do $2700 - you can do it. If they are
                    asking for $2650 - no, that would not work.
                  </em>
                </li>
                <li>
                  <strong>Contract amount $3500-$5000:</strong> You can give a
                  discount (up to $200) by rounding to the nearest hundred
                  without confirmation.
                  <br />
                  <em>
                    Example: You give a price of $4615 for a kitchen, but the
                    customer wants to do $4450 - you can do it. If they are
                    asking for $4400 - no, that would not work.
                  </em>
                </li>
                <li>
                  <strong>Contract amount $5000+:</strong> Discuss additional
                  discounts with George.
                </li>
              </ul>
              <p className="font-bold mt-6 mb-2">Important Notes:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  These discounts <strong>ARE NOT</strong> to be applied to any
                  specials.
                </li>
                <li>
                  These discounts are not to be applied right away when you tell
                  the customer the price. They can be applied during the price
                  discussion and bargaining with customers. Do not agree with a
                  lower price that the customer names right away, even when it
                  fits the above-written conditions.
                </li>
                <li>
                  Please do not forget to charge a 3% card fee, especially when
                  discounts are given.
                </li>
                <li>
                  If a customer is buying a kitchen at full price without
                  discounts and strongly disagrees with a fee - you can
                  call/text George or Dasha to see if we can waive the fee.
                </li>
              </ul>
            </div>
          </ModuleList>

          <ModuleList name="Builders">
            <div className="bg-gray-50 p-4 rounded-md mt-4">
              <p className="font-bold underline mb-2">Builder Discounts:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Quartz and Granite Colors (Levels 1, 2, 3):</strong> -
                  $3 off per square foot
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

              <p className="font-bold underline mt-4 mb-2">Sealer Offer:</p>
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
                  Projects exceeding $10,000 may be discussed separately with
                  George for potential additional discounts.
                </li>
              </ul>

              <p className="font-bold underline mt-4 mb-2">Important Notes:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>These discounts ARE NOT to be applied to any specials.</li>
                <li>
                  These discounts are not to be applied immediately but during
                  price discussions.
                </li>
                <li>
                  Don&apos;t agree to the customer&apos;s initial lower price
                  even if it fits the conditions.
                </li>
                <li>
                  Don&apos;t forget to charge a 3% card fee when discounts are
                  applied.
                </li>
                <li>
                  If the builder strongly disagrees with the fee, contact George
                  or Dasha for approval.
                </li>
              </ul>

              <p className="font-bold underline mt-4 mb-2">Deadlines:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  We can install builder&apos;s projects faster (5-7 days for
                  template and installation) but without additional discounts.
                </li>
              </ul>

              <p className="font-bold underline mt-4 mb-2">Example:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  Calacatta Laza is $80, for builder - $75. You quote the
                  kitchen at $5200:
                  <ul className="list-disc list-inside ml-5 mt-2 space-y-2">
                    <li>
                      If the builder is not rushing but asks for $5K - yes, you
                      can reduce the price to $5000.
                    </li>
                    <li>
                      If the builder needs ASAP installation, the price remains
                      $5200. &quot;ASAP&quot; and &quot;Discount&quot; do not
                      work together.
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </ModuleList>
        </BlockList>
      </Title>

      {/* Layout Module */}
      <Title text="Layout" state={layoutOpen} setState={setLayoutOpen}>
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
          <strong>2.</strong> Label each piece, marking front/back, and indicate
          in Timetree&apos;s comments which slab is used.
        </p>
        <p className="mt-2">
          <strong>3.</strong> Maximize material use: cut from the top and avoid
          edges.
        </p>
        <p className="mt-2">
          <strong>4.</strong> Mark on the paperwork Layout: yes
        </p>
        <h3 className="text-center text-xl font-semibold my-6">Main Rules</h3>
        <ul className="list-decimal list-inside space-y-4">
          <li>
            The layout should be completed the day after the template is
            created, or when the slab arrives.{" "}
            <strong>
              If a sales representative is on vacation or unavailable to create
              the layout, they must ask the shop manager or another sales
              representative to handle it.
            </strong>
          </li>
          <li>
            The template specialist must provide an estimate for the full-height
            backsplash during the initial template appointment.{" "}
            <strong>
              It is the sales representative&apos;s responsibility to verify the
              estimate after the template is completed.
            </strong>
          </li>
        </ul>
      </Title>

      {/* Selling Steps Module */}
      <Title
        text="Selling Steps"
        state={sellingStepsOpen}
        setState={setSellingStepsOpen}
      >
        <BlockList>
          <ModuleList name="Walk In">
            <p className="mt-2">
              How to approach and communicate with the customer during the first
              contact...
            </p>
          </ModuleList>
          <ModuleList name="Lead">
            <p className="mt-2">
              Techniques for presenting products and highlighting key
              benefits...
            </p>
          </ModuleList>
          <ModuleList name="Closing">
            <p className="mt-2">
              Strategies to close the sale and ensure customer satisfaction...
            </p>
          </ModuleList>
        </BlockList>
      </Title>

      {/* Responsibilities Module */}
      <Title
        text="Responsibilities"
        state={responsibilitiesOpen}
        setState={setResponsibilitiesOpen}
      >
        <BlockList>
          <ModuleList name="Customer Communications">
            <p className="mt-2">
              Guidelines for clear and effective communication with customers...
            </p>
          </ModuleList>
          <ModuleList name="Order Accuracy">
            <p className="mt-2">
              Ensure all orders and customer data are processed accurately...
            </p>
          </ModuleList>
          <ModuleList name="Timely Delivery">
            <p className="mt-2">
              Adhering to deadlines and making sure orders are delivered on
              time...
            </p>
          </ModuleList>
        </BlockList>
      </Title>

      {/* Commission Module */}
      <Title
        text="Commission"
        state={commissionOpen}
        setState={setCommissionOpen}
      >
        <BlockList>
          <li className="mb-6">
            <h3 className="mb-6 text-lg font-semibold">
              For the jobs sold after 1/1/24, we will have updated commission:
            </h3>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                <strong>Level 1 &amp; 2 stones</strong> - the commission is 3%
              </li>
              <li>
                <strong>Level 3 or above</strong> - 5%
              </li>
              <li>
                <strong>Remnants</strong> - 7%
              </li>
            </ul>
            <p className="text-lg mb-6">
              In case the job is mixed: kitchen - level 4 quartz, vanity - level
              1 granite, then please put them separately in your commission
              sheet:
            </p>
            <img
              src="./images/commission/sales_commission_list.webp"
              alt="Commission Sheet"
              className="w-full max-w-lg mx-auto mb-6"
            />

            <h2 className="text-xl font-bold my-4">Bonuses:</h2>
            <ul className="list-disc list-inside mb-4 space-y-2">
              <li>
                ➢ In case your sales per month reach $50,000 - you are getting a
                bonus of $500
              </li>
              <li>
                ➢ In case your sales per month reach $75,000 - you are getting a
                bonus of $750
              </li>
              <li>
                ➢ In case your sales per month reach $100,000 - you are getting
                a bonus of $1000
              </li>
            </ul>
            <div className="text-lg mb-6 space-y-4">
              <p>
                * The sales target must be $50,000, not $49,750. If someone
                cancels the job - it is deducted from the sales target.
              </p>
              <p>
                * In the event of a challenging situation or disagreement with a
                customer, we will do an individual examination of the commission
                payment aspect.
              </p>
              <p>
                * Bonus is paid the following week after the end of the month.
              </p>
              <p>
                * These conditions apply for January and February; after that,
                something might change.
              </p>
            </div>
            <img
              src="./images/commission/sales_commission_calendar.webp"
              alt="Sales Commission Calendar"
              className="w-full max-w-lg mx-auto mb-6"
            />
            <h3 className="text-xl font-semibold">
              ➢ Sealer commission remains the same - $1/sqft of sealer sold
            </h3>
          </li>
        </BlockList>
      </Title>

      {/* Remnants Module */}
      <Title text="Remnants" state={remnantsOpen} setState={setRemnantsOpen}>
        <div className="p-6 rounded-lg shadow-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-4">
            Remnants Policy and Procedure
          </h2>
          <ul className="list-none space-y-4">
            <RemnantText>
              <p>
                <strong>Minimum Price:</strong> Remnants start at $35 per square
                foot.
              </p>
            </RemnantText>
            <RemnantText>
              <p>
                <strong>Price per Square Foot:</strong> The price for remnants
                is determined by subtracting $20 from the standard price of the
                specific color.
              </p>
            </RemnantText>
            <RemnantText>
              <p>
                <strong>Sales Commission:</strong> Sales representatives will
                receive a 7% commission from the total sale.
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
                <strong>Minimum Order for Pick-up:</strong> Orders for remnants
                must be a minimum of $350.
              </p>
            </RemnantText>
            <RemnantText>
              <p>
                <strong>Condition of Sale:</strong> Remnants are sold as-is and
                must be inspected by the customer before purchase. If the
                customer is purchasing remotely, the salesperson must inspect
                the remnant on their behalf.
              </p>
            </RemnantText>
            <RemnantText>
              <p>
                <strong>Project Size Check:</strong> Sales representatives must
                double-check the remnant&apos;s size to ensure it covers the
                entire project, including backsplash.
              </p>
            </RemnantText>
          </ul>
        </div>
      </Title>

      {/* Objections Module */}
      <Title
        text="Objections"
        state={objectionsOpen}
        setState={setObjectionsOpen}
      >
        <BlockList>
          <ModuleList name="Custom Order">
            <p className="mt-2">
              Details about how to handle special or custom orders for
              customers...
            </p>
          </ModuleList>
        </BlockList>
      </Title>
    </PageLayout>
  );
}
