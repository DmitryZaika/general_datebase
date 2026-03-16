import type { Agent, Calls200Response } from '~/utils/cloudtalk.server'

// Helpers

function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// Mock Agents

export const MOCK_AGENTS: Agent[] = [
  {
    id: 1001,
    name: 'Sarah Johnson',
    firstname: 'Sarah',
    lastname: 'Johnson',
    email: 'sarah@example.com',
    pass: '',
    is_daily_limit_ok: true,
    status_outbound: true,
    availability_status: 'online',
    extension: 101,
    call_number_id: 1,
    default_number: '+15551010101',
    associated_numbers: ['+15551010101'],
  },
  {
    id: 1002,
    name: 'Mike Chen',
    firstname: 'Mike',
    lastname: 'Chen',
    email: 'mike@example.com',
    pass: '',
    is_daily_limit_ok: true,
    status_outbound: true,
    availability_status: 'offline',
    extension: 102,
    call_number_id: 2,
    default_number: '+15551020202',
    associated_numbers: ['+15551020202'],
  },
  {
    id: 1003,
    name: 'Lisa Rodriguez',
    firstname: 'Lisa',
    lastname: 'Rodriguez',
    email: 'lisa@example.com',
    pass: '',
    is_daily_limit_ok: true,
    status_outbound: true,
    availability_status: 'calling',
    extension: 103,
    call_number_id: 3,
    default_number: '+15551030303',
    associated_numbers: ['+15551030303'],
  },
  {
    id: 1004,
    name: 'David Kim',
    firstname: 'David',
    lastname: 'Kim',
    email: 'david@example.com',
    pass: '',
    is_daily_limit_ok: true,
    status_outbound: false,
    availability_status: 'paused',
    extension: 104,
    call_number_id: 4,
    default_number: '+15551040404',
    associated_numbers: ['+15551040404'],
  },
]

// Mock Call Recording (WAV data URL — 3s 440Hz sine wave)

function generateMockWavDataUrl(): string {
  const sampleRate = 8000
  const durationSec = 3
  const frequency = 440
  const numSamples = sampleRate * durationSec
  const dataSize = numSamples * 2
  const fileSize = 44 + dataSize

  const buffer = new ArrayBuffer(fileSize)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, fileSize - 8, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.min(1, t * 4) * Math.min(1, (durationSec - t) * 4)
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.5 * envelope
    view.setInt16(44 + i * 2, sample * 32767, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}

export const MOCK_RECORDING_URL = generateMockWavDataUrl()

// Shared mock fragments

const mockCallNumber = {
  id: 1,
  internal_name: 'Main Line',
  caller_id_e164: '+15551010101',
  country_code: 1,
  area_code: 555,
}

function mockAgent(agent: Agent) {
  return {
    id: agent.id,
    firstname: agent.firstname,
    lastname: agent.lastname,
    fullname: `${agent.firstname} ${agent.lastname}`,
    email: agent.email,
    language: 'en',
    role: 'agent',
    status: agent.availability_status,
    default_outbound_number: agent.default_number,
    associated_numbers: agent.associated_numbers,
    groups: ['Sales'],
  }
}

function mockContact(phone: string) {
  return {
    id: 5001,
    name: 'Mock Customer',
    title: '',
    company: '',
    industry: '',
    address: '',
    city: '',
    zip: '',
    state: '',
    type: 'customer',
    contact_numbers: [phone],
    contact_emails: ['customer@example.com'],
    tags: [] as { id: number; name: string }[],
    external_urls: [] as {
      external_system: string
      external_url: string
    }[],
    custom_fields: [] as { key: string; value: string }[],
    favorite_agent: mockAgent(MOCK_AGENTS[0]),
  }
}

function makeCdr(
  overrides: Partial<Calls200Response['Cdr']> & {
    id: number
    started_at: string
    public_external: string
  },
): Calls200Response['Cdr'] {
  return {
    billsec: overrides.talking_time ?? 0,
    type: 'incoming',
    public_internal: '+15551010101',
    recorded: false,
    is_voicemail: false,
    fax_email: '',
    is_redirected: '',
    redirected_from: '',
    transferred_from: '',
    is_local: false,
    user_id: 1001,
    talking_time: 0,
    answered_at: overrides.started_at,
    ended_at: overrides.started_at,
    waiting_time: 0,
    wrapup_time: 0,
    recording_link: 0,
    ...overrides,
  }
}

function makeCall(
  cdr: Calls200Response['Cdr'],
  agent: Agent,
  notes: Calls200Response['Notes'],
  tags: Calls200Response['Tags'],
  ratings: Calls200Response['Ratings'],
): Calls200Response {
  return {
    Cdr: cdr,
    Contact: mockContact(cdr.public_external),
    CallNumber: mockCallNumber,
    BillingData: { price: 0 },
    Agent: mockAgent(agent),
    Notes: notes,
    Tags: tags,
    Ratings: ratings,
  }
}

// Mock Calls — covers all scenarios

export function getMockCallsForCustomer(
  phone: string | null,
  phone2: string | null,
): Calls200Response[] {
  const p1 = phone ?? '+15559990001'
  const p2 = phone2 ?? p1
  const [sarah, mike, lisa, david] = MOCK_AGENTS

  return [
    // 1. Incoming answered — recording, notes, tags, ratings
    makeCall(
      makeCdr({
        id: 3001,
        type: 'incoming',
        started_at: daysAgo(1, 14, 30),
        talking_time: 323,
        recorded: true,
        recording_link: 9001,
        public_external: p1,
        user_id: sarah.id,
      }),
      sarah,
      [{ id: 1, name: 'Customer wants quote for kitchen countertop' }],
      [
        { id: 1, name: 'follow-up' },
        { id: 2, name: 'urgent' },
      ],
      [{ id: 1, type: 'contact', rating: 5 }],
    ),
    // 2. Incoming answered — short, no recording
    makeCall(
      makeCdr({
        id: 3002,
        type: 'incoming',
        started_at: daysAgo(2, 9, 15),
        talking_time: 45,
        public_external: p1,
        user_id: mike.id,
      }),
      mike,
      [],
      [],
      [],
    ),
    // 3. Incoming missed
    makeCall(
      makeCdr({
        id: 3003,
        type: 'incoming',
        started_at: daysAgo(3, 16, 45),
        talking_time: 0,
        public_external: p1,
        user_id: sarah.id,
      }),
      sarah,
      [],
      [{ id: 3, name: 'missed' }],
      [],
    ),
    // 4. Voicemail — recorded
    makeCall(
      makeCdr({
        id: 3004,
        type: 'incoming',
        started_at: daysAgo(4, 11, 20),
        talking_time: 28,
        recorded: true,
        recording_link: 9002,
        is_voicemail: true,
        public_external: p1,
        user_id: lisa.id,
      }),
      lisa,
      [{ id: 2, name: 'Left voicemail about backsplash options' }],
      [{ id: 4, name: 'voicemail' }],
      [],
    ),
    // 5. Outgoing answered — recording, notes, tags, rating
    makeCall(
      makeCdr({
        id: 3005,
        type: 'outgoing',
        started_at: daysAgo(5, 10, 0),
        talking_time: 542,
        recorded: true,
        recording_link: 9003,
        public_external: p1,
        user_id: sarah.id,
      }),
      sarah,
      [
        {
          id: 3,
          name: 'Discussed marble vs quartz pricing. Customer leaning towards quartz.',
        },
      ],
      [
        { id: 5, name: 'quote' },
        { id: 6, name: 'quartz' },
      ],
      [{ id: 2, type: 'agent', rating: 4 }],
    ),
    // 6. Outgoing no-answer
    makeCall(
      makeCdr({
        id: 3006,
        type: 'outgoing',
        started_at: daysAgo(6, 15, 30),
        talking_time: 0,
        public_external: p1,
        user_id: mike.id,
      }),
      mike,
      [],
      [],
      [],
    ),
    // 7. Outgoing answered — long call
    makeCall(
      makeCdr({
        id: 3007,
        type: 'outgoing',
        started_at: daysAgo(7, 13, 15),
        talking_time: 2700,
        recorded: true,
        recording_link: 9004,
        public_external: p1,
        user_id: david.id,
      }),
      david,
      [
        {
          id: 4,
          name: 'Full project walkthrough — kitchen, 2 bathrooms. Needs measurements.',
        },
      ],
      [
        { id: 7, name: 'large-project' },
        { id: 8, name: 'measurement' },
      ],
      [
        { id: 3, type: 'contact', rating: 5 },
        { id: 4, type: 'agent', rating: 5 },
      ],
    ),
    // 8. Internal call
    makeCall(
      makeCdr({
        id: 3008,
        type: 'internal',
        started_at: daysAgo(8, 9, 0),
        talking_time: 120,
        public_external: p1,
        user_id: sarah.id,
      }),
      sarah,
      [],
      [],
      [],
    ),
    // 9. Incoming answered — rating only
    makeCall(
      makeCdr({
        id: 3009,
        type: 'incoming',
        started_at: daysAgo(10, 11, 0),
        talking_time: 180,
        recorded: true,
        recording_link: 9005,
        public_external: p1,
        user_id: lisa.id,
      }),
      lisa,
      [],
      [{ id: 9, name: 'general-inquiry' }],
      [{ id: 5, type: 'contact', rating: 3 }],
    ),
    // 10. Outgoing answered — short follow-up
    makeCall(
      makeCdr({
        id: 3010,
        type: 'outgoing',
        started_at: daysAgo(12, 16, 0),
        talking_time: 95,
        public_external: p1,
        user_id: mike.id,
      }),
      mike,
      [{ id: 5, name: 'Confirmed appointment for Thursday' }],
      [{ id: 10, name: 'appointment' }],
      [],
    ),
    // 11. Incoming missed — second phone
    makeCall(
      makeCdr({
        id: 3011,
        type: 'incoming',
        started_at: daysAgo(14, 8, 30),
        talking_time: 0,
        public_external: p2,
        user_id: david.id,
      }),
      david,
      [],
      [],
      [],
    ),
    // 12. Incoming answered — second phone, recording
    makeCall(
      makeCdr({
        id: 3012,
        type: 'incoming',
        started_at: daysAgo(15, 14, 0),
        talking_time: 210,
        recorded: true,
        recording_link: 9006,
        public_external: p2,
        user_id: sarah.id,
      }),
      sarah,
      [{ id: 6, name: 'Customer asked about sink options' }],
      [{ id: 11, name: 'sink' }],
      [],
    ),
    // 13. Outgoing — medium call, recording
    makeCall(
      makeCdr({
        id: 3013,
        type: 'outgoing',
        started_at: daysAgo(18, 11, 30),
        talking_time: 420,
        recorded: true,
        recording_link: 9007,
        public_external: p1,
        user_id: lisa.id,
      }),
      lisa,
      [],
      [{ id: 12, name: 'pricing' }],
      [{ id: 6, type: 'agent', rating: 4 }],
    ),
    // 14. Voicemail — older
    makeCall(
      makeCdr({
        id: 3014,
        type: 'incoming',
        started_at: daysAgo(22, 17, 0),
        talking_time: 15,
        recorded: true,
        recording_link: 9008,
        is_voicemail: true,
        public_external: p1,
        user_id: mike.id,
      }),
      mike,
      [{ id: 7, name: 'Asked to call back about installation date' }],
      [{ id: 13, name: 'voicemail' }],
      [],
    ),
    // 15. Incoming missed — oldest
    makeCall(
      makeCdr({
        id: 3015,
        type: 'incoming',
        started_at: daysAgo(25, 12, 0),
        talking_time: 0,
        public_external: p1,
        user_id: sarah.id,
      }),
      sarah,
      [],
      [],
      [],
    ),
  ]
}
