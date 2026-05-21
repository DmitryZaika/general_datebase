import type { MockCustomer, SmsMessage, SmsThread } from './types'

// Mock fixtures exercising every UX state — linked vs unlinked, unread counts,
// conversation lengths, recency, long/multi-line/emoji text, unknown phones.

const NOW = new Date('2026-05-21T15:30:00Z').getTime()

const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString()
const hours = (n: number) => new Date(NOW - n * 3_600_000).toISOString()
const days = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

function mkMessage(
  id: string,
  direction: SmsMessage['direction'],
  text: string,
  createdAt: string,
  agent: string | null = null,
): SmsMessage {
  return { id, direction, text, createdAt, agent, status: 'sent' }
}

export const MOCK_CUSTOMERS: MockCustomer[] = [
  { id: 101, name: 'Sarah Johnson', phone: '3173161456' },
  { id: 102, name: 'Mike Chen', phone: '6468956758' },
  { id: 103, name: 'Anna Petrov', phone: '7185551234' },
  { id: 104, name: 'David Williams', phone: '4155557890' },
  { id: 105, name: 'Jessica Brown', phone: '2125559876' },
  { id: 106, name: 'Robert Taylor', phone: '9495551111' },
  { id: 107, name: 'Linda Garcia', phone: '8085552222' },
  { id: 108, name: 'James Anderson', phone: '3475553333' },
]

export const MOCK_AGENT_NAME = 'You'
export const MOCK_OTHER_AGENT_NAME = 'Anna Kuhir'

export const MOCK_THREADS: SmsThread[] = [
  {
    phoneDigits: '3173161456',
    customer: { id: 101, name: 'Sarah Johnson' },
    assignedToCurrentUser: true,
    unreadCount: 2,
    messages: [
      mkMessage(
        'sj-1',
        'inbound',
        'Hi! Is the Calacatta Gold slab from your showroom still available?',
        minutes(35),
      ),
      mkMessage(
        'sj-2',
        'outbound',
        'Yes, it is. Would you like to come in this week to take a look?',
        minutes(25),
        MOCK_AGENT_NAME,
      ),
      mkMessage(
        'sj-3',
        'inbound',
        'Yes please — can I come Thursday at 2pm?',
        minutes(8),
      ),
      mkMessage(
        'sj-4',
        'inbound',
        "I'll bring the cabinet drawings so we can lay out the seam.",
        minutes(5),
      ),
    ],
  },

  {
    phoneDigits: '5125559090',
    customer: null,
    assignedToCurrentUser: false,
    unreadCount: 1,
    messages: [
      mkMessage(
        'un-1',
        'inbound',
        "Hi, I saw your ad on Instagram. Do you do quartz countertops in the 30 sqft range? Roughly what's the price?",
        minutes(45),
      ),
    ],
  },

  {
    phoneDigits: '6468956758',
    customer: { id: 102, name: 'Mike Chen' },
    assignedToCurrentUser: true,
    unreadCount: 0,
    messages: [
      mkMessage('mc-1', 'inbound', 'Hey, are you guys open this Saturday?', days(2)),
      mkMessage(
        'mc-2',
        'outbound',
        'Yes, 9am-3pm. Did you want to come by to look at the white quartz options we talked about?',
        days(2),
        MOCK_OTHER_AGENT_NAME,
      ),
      mkMessage(
        'mc-3',
        'inbound',
        "Yes — I'll bring my wife. See you around 10.",
        days(2),
      ),
      mkMessage(
        'mc-4',
        'outbound',
        'Perfect, see you then. Sample fee is waived if you order.',
        days(2),
        MOCK_OTHER_AGENT_NAME,
      ),
      mkMessage(
        'mc-5',
        'inbound',
        'We loved the Pure White — can you send me a quote for 45 sqft installed?',
        days(1),
      ),
      mkMessage(
        'mc-6',
        'outbound',
        "On it. I'll have the quote over by end of day.",
        days(1),
        MOCK_AGENT_NAME,
      ),
      mkMessage(
        'mc-7',
        'inbound',
        'Got it, thanks. One question — does the price include the cooktop cutout?',
        hours(20),
      ),
      mkMessage(
        'mc-8',
        'outbound',
        'Yes, one standard cutout is included. Additional cutouts are $75 each.',
        hours(19),
        MOCK_AGENT_NAME,
      ),
      mkMessage('mc-9', 'inbound', 'Perfect 👍 ready to move forward.', hours(2)),
    ],
  },

  {
    phoneDigits: '7185551234',
    customer: { id: 103, name: 'Anna Petrov' },
    assignedToCurrentUser: false,
    unreadCount: 0,
    messages: [
      mkMessage(
        'ap-1',
        'outbound',
        'Hi Anna — your install is confirmed for next Tuesday at 8am. Reply YES to confirm.',
        hours(6),
        MOCK_OTHER_AGENT_NAME,
      ),
      mkMessage('ap-2', 'inbound', 'YES, confirmed. Thanks!', hours(5)),
    ],
  },

  {
    phoneDigits: '4155557890',
    customer: { id: 104, name: 'David Williams' },
    assignedToCurrentUser: true,
    unreadCount: 0,
    messages: [
      mkMessage(
        'dw-1',
        'inbound',
        'Hi, looking for kitchen countertop replacement. Roughly 80 sqft, prefer granite.',
        days(8),
      ),
      mkMessage(
        'dw-2',
        'outbound',
        'Happy to help. Could you send a picture of the current kitchen and your zip code?',
        days(8),
        MOCK_AGENT_NAME,
      ),
      mkMessage(
        'dw-3',
        'inbound',
        'Decided to go with another vendor — but appreciate the quick response.',
        days(7),
      ),
    ],
  },

  {
    phoneDigits: '6175557777',
    customer: null,
    assignedToCurrentUser: false,
    unreadCount: 3,
    messages: [
      mkMessage('un2-1', 'inbound', 'Hi, do you carry Taj Mahal quartzite?', hours(11)),
      mkMessage(
        'un2-2',
        'inbound',
        'Looking for full slab, white with golden veining.',
        hours(11),
      ),
      mkMessage('un2-3', 'inbound', 'How soon can I see it?', hours(11)),
    ],
  },

  {
    phoneDigits: '2125559876',
    customer: { id: 105, name: 'Jessica Brown' },
    assignedToCurrentUser: true,
    unreadCount: 0,
    messages: [
      mkMessage(
        'jb-1',
        'outbound',
        "Hi Jessica! Just checking in — how's the new countertop holding up?",
        days(14),
        MOCK_AGENT_NAME,
      ),
      mkMessage(
        'jb-2',
        'inbound',
        "Love it! Already had two friends ask who did it. I'll send them your way.",
        days(13),
      ),
      mkMessage(
        'jb-3',
        'outbound',
        'That means a lot, thank you 🙏',
        days(13),
        MOCK_AGENT_NAME,
      ),
    ],
  },

  {
    phoneDigits: '9495551111',
    customer: { id: 106, name: 'Robert Taylor' },
    assignedToCurrentUser: false,
    unreadCount: 1,
    messages: [
      mkMessage(
        'rt-1',
        'inbound',
        'Mike Chen referred me — looking to get a quote for a 30 sqft island.',
        hours(4),
      ),
    ],
  },

  {
    phoneDigits: '8085552222',
    customer: { id: 107, name: 'Linda Garcia' },
    assignedToCurrentUser: true,
    unreadCount: 1,
    messages: [
      mkMessage('lg-1', 'inbound', 'Are you available for a quick call?', minutes(2)),
    ],
  },

  {
    phoneDigits: '3475553333',
    customer: { id: 108, name: 'James Anderson' },
    assignedToCurrentUser: true,
    unreadCount: 0,
    messages: [
      mkMessage(
        'ja-1',
        'inbound',
        "Hello! I wanted to follow up on the consult last week. Here's what we decided:\n\n• Main kitchen: Calacatta Gold, full slab, 60 sqft\n• Island: same stone, 28 sqft, waterfall edge\n• Bathroom vanity #1: Pure White quartz\n• Bathroom vanity #2: same as #1\n\nLet me know if these match the quote you had in mind. Looking to start in the next 3-4 weeks if possible. Thanks! 🏡",
        days(3),
      ),
      mkMessage(
        'ja-2',
        'outbound',
        "Hi James — yes, these match the quote. I'll send revised numbers with the waterfall today. We can hold a slot for week of June 8.",
        days(3),
        MOCK_AGENT_NAME,
      ),
    ],
  },
]

export function buildThreadSummary(thread: SmsThread): {
  phoneDigits: string
  customerId: number | null
  customerName: string | null
  lastMessageText: string
  lastMessageAt: string
  lastDirection: SmsMessage['direction']
  lastAgent: string | null
  messageCount: number
  unreadCount: number
} {
  const last = thread.messages[thread.messages.length - 1]
  return {
    phoneDigits: thread.phoneDigits,
    customerId: thread.customer?.id ?? null,
    customerName: thread.customer?.name ?? null,
    lastMessageText: last.text,
    lastMessageAt: last.createdAt,
    lastDirection: last.direction,
    lastAgent: last.agent,
    messageCount: thread.messages.length,
    unreadCount: thread.unreadCount,
  }
}
