import { type LoaderFunctionArgs, redirect } from 'react-router'

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const dealId = params.dealId
  const threadId = params.threadId
  if (!dealId || !threadId) {
    throw new Error('Deal or thread ID is missing')
  }
  const url = new URL(request.url)
  return redirect(`/admin/deals/edit/${dealId}/project/chat/${threadId}${url.search}`)
}

export default function AdminDealsHistoryChatRedirect() {
  return null
}
