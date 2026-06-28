import { Check, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  GraniteManagerMarketingBackground,
  GraniteManagerMarketingHeader,
  MarketingDemoArrow,
  MarketingDemoButtonLabel,
  MarketingSlideDown,
  scrollToMarketingSection,
  useGraniteManagerCalendly,
  useGraniteManagerCalendlyConfigured,
} from '~/components/organisms/GraniteManagerMarketingShell'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { loginLogo } from '~/constants/logos'
import { calculateMonthlyPrice, pricingSummary } from '~/utils/graniteManagerPricing'

const CORE_FEATURES = [
  'AI Instructions',
  'Inventory',
  'Emails',
  'Deal Pipeline',
  'Phone Call Recording',
  'Sales Rep Activity Tracking',
  'Documents, Images & Suppliers',
  'Customer Display',
  'Post-Installation Checklists',
  'Marketing Page',
  'Slab & Cutting Track',
  'Consignment Reports',
]

const WHY_CHOOSE = [
  {
    title: 'Turn Leads Into Closed Jobs',
    body: 'Track walk-ins, call-ins, and web leads in one pipeline. Follow up faster and see where every deal stands.',
  },
  {
    title: 'AI That Knows Your Process',
    body: 'Use AI instructions to guide your team through quotes, templates, and customer communication with less guesswork.',
  },
  {
    title: 'Email and SMS in Context',
    body: 'Send and review customer messages without jumping between inboxes. History stays tied to the customer and deal.',
  },
  {
    title: 'Inventory You Can Trust',
    body: 'Manage slabs, sinks, faucets, and supplier info in one place so sales and production work from the same numbers.',
  },
  {
    title: 'Calls Recorded and Searchable',
    body: 'Review CloudTalk call recordings and activity so managers can coach reps and recover missed details.',
  },
  {
    title: 'See What Your Team Is Doing',
    body: 'Track sales rep activity, notes, and deal updates so owners always know what happened and what is next.',
  },
  {
    title: 'Customer Display Linked to Inventory',
    body: 'Show live stone inventory on a customer-facing display in your showroom. Slabs, photos, and availability stay synced with what your team manages in the CRM.',
  },
  {
    title: 'Post-Installation Checklists',
    body: 'Installers submit job completion checklists from the field. Customers receive post-install survey links by email or SMS so you capture feedback while the job is fresh.',
  },
  {
    title: 'Marketing Page for Lead Teams',
    body: 'Give marketing staff a dedicated leads workspace. Track walk-ins, web leads, and deal progress without giving them full CRM access they do not need.',
  },
  {
    title: 'Slab & Cutting Track',
    body: 'Shop workers log transactions, mark slabs as cut, and track production progress so sales and the shop floor stay aligned on what is sold, cut, and ready.',
  },
  {
    title: 'Consignment Reports',
    body: 'Pull cut-slab reports by supplier, stone, and date range. Export what was used from consignment inventory so you can reconcile with suppliers without spreadsheets.',
  },
]

const FAQ = [
  {
    q: 'What is Granite Manager?',
    a: 'Granite Manager is an AI CRM system built for countertop and stone shops. It helps you manage customers, deals, inventory, communication, and team activity in one platform.',
  },
  {
    q: 'Who is it for?',
    a: 'It is designed for sales teams, office staff, and owners who want a focused CRM instead of a heavy ERP with add-ons they never use.',
  },
  {
    q: 'How does pricing work?',
    a: 'The base plan is $300 per month for up to 10 users. When you add an 11th user, the price becomes $330 per month, then $30 for each additional user after that.',
  },
  {
    q: 'What happens on a demo call?',
    a: 'We walk through your current workflow, show how Granite Manager handles leads, deals, email, inventory, customer displays, post-install checklists, marketing, slab and cutting tracking, consignment reports, and AI tools, then answer your questions.',
  },
]

export function GraniteManagerLanding() {
  const location = useLocation()
  const openDemo = useGraniteManagerCalendly()
  const hasCalendly = useGraniteManagerCalendlyConfigured()
  const [users, setUsers] = useState(5)
  const monthly = calculateMonthlyPrice(users)

  useEffect(() => {
    if (location.hash !== '#demo' && location.hash !== '#pricing') return
    const id = location.hash.slice(1)
    const target = document.getElementById(id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth' })
  }, [location.hash, location.pathname])

  return (
    <GraniteManagerMarketingBackground>
      <GraniteManagerMarketingHeader onDemo={openDemo} />

      <section className='relative overflow-hidden border-b border-slate-100'>
        <div className='relative mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24'>
          <MarketingSlideDown delay={0} className='flex flex-col justify-center'>
            <p className='mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500'>
              AI CRM System
            </p>
            <h1 className='text-4xl font-bold leading-tight tracking-tight md:text-5xl'>
              The CRM built for countertop and stone sales teams
            </h1>
            <p className='mt-5 max-w-xl text-lg leading-relaxed text-slate-600'>
              Run leads, deals, email, inventory, showroom displays, slab and cutting
              tracking, and rep activity in one focused system. Less juggling. Fewer
              missed follow-ups. More jobs closed.
            </p>
            <div className='mt-8 flex flex-wrap gap-3'>
              <button
                type='button'
                onClick={openDemo}
                className='group relative inline-flex cursor-pointer items-center overflow-hidden rounded-full bg-slate-900 py-3 pl-6 pr-10 text-sm font-semibold text-white hover:bg-slate-800'
              >
                <MarketingDemoButtonLabel variant='free' />
                <MarketingDemoArrow />
              </button>
              <button
                type='button'
                onClick={() => scrollToMarketingSection('pricing')}
                className='inline-flex cursor-pointer items-center rounded-full border border-slate-300 bg-transparent px-6 py-3 text-sm font-semibold text-slate-800 transition-colors duration-300 ease-out hover:border-black hover:bg-black hover:text-white'
              >
                View Pricing
              </button>
            </div>
          </MarketingSlideDown>
          <MarketingSlideDown delay={120} className='flex items-center justify-center'>
            <div className='w-full max-w-lg rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm sm:p-6 md:aspect-[4/3] md:p-8'>
              <div className='flex flex-col gap-4 rounded-xl bg-white p-4 shadow-sm sm:gap-5 sm:p-6 md:h-full md:justify-between'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>
                    Dashboard preview
                  </p>
                  <p className='mt-2 text-lg font-semibold sm:text-xl'>
                    Your shop at a glance
                  </p>
                </div>
                <div className='grid grid-cols-2 gap-2 text-xs sm:gap-3 sm:text-sm'>
                  <div className='rounded-lg bg-slate-100 p-2 sm:p-3'>Open deals</div>
                  <div className='rounded-lg bg-slate-100 p-2 sm:p-3'>New leads</div>
                  <div className='rounded-lg bg-slate-100 p-2 sm:p-3'>Unread email</div>
                  <div className='rounded-lg bg-slate-100 p-2 sm:p-3'>Rep activity</div>
                </div>
                <p className='text-xs text-slate-500'>
                  Product screenshots coming soon
                </p>
              </div>
            </div>
          </MarketingSlideDown>
        </div>
      </section>

      <section className='border-b border-slate-100 bg-slate-50 py-16 md:py-20'>
        <div className='mx-auto max-w-6xl px-4 md:px-6'>
          <h2 className='max-w-3xl text-3xl font-bold tracking-tight md:text-4xl'>
            Cut your reliance on add-ons and keep everything in one place
          </h2>
          <p className='mt-4 max-w-2xl text-lg text-slate-600'>
            Granite Manager brings the tools a stone shop actually uses every day into a
            single AI CRM — without paying for modules you do not need.
          </p>
          <ul className='mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {CORE_FEATURES.map(feature => (
              <li
                key={feature}
                className='flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800'
              >
                <span className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white'>
                  <Check className='h-4 w-4' />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className='py-16 md:py-20'>
        <div className='mx-auto max-w-6xl px-4 md:px-6'>
          <p className='text-sm font-semibold uppercase tracking-wider text-slate-500'>
            Why shops choose Granite Manager
          </p>
          <h2 className='mt-2 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl'>
            Built for sales, communication, and daily shop operations
          </h2>
          <div className='mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {WHY_CHOOSE.map(item => (
              <article
                key={item.title}
                className='rounded-2xl border border-slate-200 p-6 shadow-sm'
              >
                <h3 className='text-lg font-semibold'>{item.title}</h3>
                <p className='mt-3 text-sm leading-relaxed text-slate-600'>
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className='border-y border-slate-100 bg-slate-900 py-16 text-white md:py-20'>
        <div className='mx-auto max-w-6xl px-4 md:px-6'>
          <div className='grid gap-10 md:grid-cols-3'>
            <div>
              <p className='text-4xl font-bold'>1 CRM</p>
              <p className='mt-2 text-slate-300'>
                Customers, deals, email, calls, inventory, and showroom display
                connected
              </p>
            </div>
            <div>
              <p className='text-4xl font-bold'>AI built in</p>
              <p className='mt-2 text-slate-300'>
                Instructions and message tools that match how your team works
              </p>
            </div>
            <div>
              <p className='text-4xl font-bold'>Less chaos</p>
              <p className='mt-2 text-slate-300'>
                Stop losing details across texts, spreadsheets, and separate apps
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id='pricing' className='scroll-mt-24 py-16 md:py-24'>
        <div className='mx-auto max-w-6xl px-4 md:px-6'>
          <MarketingSlideDown
            whenVisible
            delay={0}
            className='mx-auto max-w-2xl text-center'
          >
            <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
              Build your price
            </h2>
            <p className='mt-4 text-slate-600'>
              Simple team pricing. $300 per month for up to 10 users. Add more users as
              you grow.
            </p>
          </MarketingSlideDown>

          <MarketingSlideDown
            whenVisible
            delay={120}
            className='mx-auto mt-12 max-w-xl'
          >
            <div className='rounded-2xl border border-slate-200 bg-white p-8 shadow-lg'>
              <div className='flex items-center justify-between gap-4'>
                <div>
                  <p className='text-sm font-medium text-slate-500'>Team size</p>
                  <p className='mt-1 text-3xl font-bold tabular-nums'>{users} users</p>
                </div>
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    aria-label='Decrease users'
                    className='flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50'
                    onClick={() => setUsers(value => Math.max(1, value - 1))}
                  >
                    <Minus className='h-4 w-4' />
                  </button>
                  <button
                    type='button'
                    aria-label='Increase users'
                    className='flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-50'
                    onClick={() => setUsers(value => Math.min(500, value + 1))}
                  >
                    <Plus className='h-4 w-4' />
                  </button>
                </div>
              </div>

              <input
                type='range'
                min={1}
                max={50}
                value={users}
                onChange={event => setUsers(Number(event.target.value))}
                className='mt-8 w-full accent-slate-900'
              />

              <div className='mt-8 rounded-xl bg-slate-50 p-6 text-center'>
                <p className='text-sm font-medium text-slate-500'>
                  Estimated monthly total
                </p>
                <p className='mt-2 text-5xl font-bold tabular-nums tracking-tight'>
                  ${monthly}
                  <span className='text-lg font-medium text-slate-500'> / month</span>
                </p>
                <p className='mt-3 text-sm text-slate-600'>{pricingSummary(users)}</p>
              </div>

              <ul className='mt-6 space-y-2 text-sm text-slate-700'>
                <li className='flex items-start gap-2'>
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-slate-900' />
                  Full AI CRM platform for your team
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-slate-900' />
                  All core features included
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-slate-900' />
                  $300 flat for teams up to 10 users
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-slate-900' />
                  $330 at 11 users, then +$30 per additional user
                </li>
              </ul>

              <button
                type='button'
                onClick={openDemo}
                className='mt-8 w-full cursor-pointer rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800'
              >
                Schedule a Demo
              </button>
            </div>
          </MarketingSlideDown>
        </div>
      </section>

      <section
        id='demo'
        className='border-t border-slate-100 bg-slate-50 py-16 md:py-20'
      >
        <div className='mx-auto max-w-3xl px-4 text-center md:px-6'>
          <h2 className='text-3xl font-bold tracking-tight'>
            See Granite Manager in action
          </h2>
          <p className='mt-4 text-lg text-slate-600'>
            Book a short intro call. We will show how your team can manage leads, deals,
            email, inventory, showroom displays, install checklists, marketing, and slab
            and cutting tracking in one AI CRM.
          </p>
          <button
            type='button'
            onClick={openDemo}
            className='group relative mt-8 inline-flex cursor-pointer items-center overflow-hidden rounded-full bg-slate-900 py-3 pl-8 pr-10 text-sm font-semibold text-white hover:bg-slate-800'
          >
            <MarketingDemoButtonLabel variant='short' />
            <MarketingDemoArrow />
          </button>
          {hasCalendly ? null : (
            <p className='mt-4 text-sm text-slate-500'>
              Or email{' '}
              <a
                href='mailto:sales@granite-manager.com'
                className='font-medium text-slate-800 underline'
              >
                sales@granite-manager.com
              </a>
            </p>
          )}
        </div>
      </section>

      <section className='py-16 md:py-20'>
        <div className='mx-auto max-w-3xl px-4 md:px-6'>
          <MarketingSlideDown whenVisible delay={0} className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight'>Questions & answers</h2>
          </MarketingSlideDown>
          <MarketingSlideDown whenVisible delay={120} className='mt-10'>
            <Accordion type='single' collapsible className='w-full'>
              {FAQ.map((item, index) => (
                <AccordionItem
                  key={item.q}
                  value={`faq-${index}`}
                  className='border-slate-200'
                >
                  <AccordionTrigger className='py-5 text-base font-medium text-slate-900 hover:no-underline before:hidden data-[state=open]:before:scale-x-0'>
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className='pb-5 text-sm leading-relaxed text-slate-600'>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </MarketingSlideDown>
        </div>
      </section>

      <footer className='border-t border-slate-200 bg-white py-10'>
        <div className='mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-6'>
          <div className='flex items-center gap-3'>
            <img
              src={loginLogo}
              alt='Granite Manager'
              className='h-8 w-8 object-contain'
            />
            <span className='font-semibold text-slate-900'>Granite Manager</span>
          </div>
          <div className='flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600'>
            <button
              type='button'
              onClick={() => scrollToMarketingSection('pricing')}
              className='cursor-pointer hover:text-slate-900'
            >
              Pricing
            </button>
            <Link to='/login' className='hover:text-slate-900'>
              Login
            </Link>
            <a href='mailto:sales@granite-manager.com' className='hover:text-slate-900'>
              sales@granite-manager.com
            </a>
          </div>
          <p className='text-xs text-slate-400'>
            © {new Date().getFullYear()} Granite Manager
          </p>
        </div>
      </footer>
    </GraniteManagerMarketingBackground>
  )
}
