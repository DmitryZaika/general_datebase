import { renderToReadableStream } from 'react-dom/server'
import type { AppLoadContext, EntryContext } from 'react-router'
import { ServerRouter } from 'react-router'

export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError() {
        status = 500
      },
    },
  )

  headers.set('Content-Type', 'text/html; charset=utf-8')

  return new Response(stream, { status, headers })
}
