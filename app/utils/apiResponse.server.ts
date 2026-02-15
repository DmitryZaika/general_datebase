import { data, redirect } from 'react-router'
import { posthogClient } from '~/utils/posthog.server'

export enum HttpStatus {
  OK = 200,
  BadRequest = 400,
  Unauthorized = 401,
  NotFound = 404,
  InternalServerError = 500,
}

interface SuccessResponse {
  success: true
  error: null
}

interface ErrorResponse {
  success: false
  error: string
}

export type ApiResponse = SuccessResponse | ErrorResponse

export function success(): ReturnType<typeof data<SuccessResponse>> {
  return data({ success: true, error: null } satisfies SuccessResponse)
}

export function badRequest(message: string): ReturnType<typeof data<ErrorResponse>> {
  return data(
    { success: false, error: message } satisfies ErrorResponse,
    { status: HttpStatus.BadRequest },
  )
}

export function notFound(message: string): ReturnType<typeof data<ErrorResponse>> {
  return data(
    { success: false, error: message } satisfies ErrorResponse,
    { status: HttpStatus.NotFound },
  )
}

export function serverError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): ReturnType<typeof data<ErrorResponse>> {
  posthogClient.captureException(error, message, context)
  return data(
    { success: false, error: message } satisfies ErrorResponse,
    { status: HttpStatus.InternalServerError },
  )
}

export function handleAuthError(error: unknown): ReturnType<typeof redirect> | ReturnType<typeof data<ErrorResponse>> {
  if (error instanceof TypeError) {
    return redirect('/login')
  }
  return serverError('An unexpected error occurred', error)
}
