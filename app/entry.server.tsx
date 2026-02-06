import { isbot } from 'isbot'
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
  const userAgent = request.headers.get('user-agent')

  const stream = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error) {
        console.error(error)
        status = 500
      },
    },
  )

  if (userAgent && isbot(userAgent)) await stream.allReady
  else headers.set('Transfer-Encoding', 'chunked')

  headers.set('Content-Type', 'text/html; charset=utf-8')

  return new Response(stream, { status, headers })
}
