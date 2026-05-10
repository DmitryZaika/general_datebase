import { zodResponseFormat } from 'openai/helpers/zod'
import { openai } from './client.server'
import { trackUsage } from './telemetry.server'
import type { AITask, Usage } from './types'

export async function runTask<I, O>(
  task: AITask<I, O>,
  input: I,
  userId?: number,
): Promise<O> {
  const messages = task.buildMessages(input)

  if (task.outputSchema) {
    const completion = await openai.chat.completions.parse({
      model: task.model,
      messages,
      temperature: task.temperature,
      max_completion_tokens: task.maxTokens,
      response_format: zodResponseFormat(task.outputSchema, task.name),
    })
    trackUsage(task.name, completion.usage, userId)
    const parsed = completion.choices[0]?.message?.parsed
    if (!parsed) throw new Error(`Task ${task.name}: model returned no parsed output`)
    return parsed
  }

  const completion = await openai.chat.completions.create({
    model: task.model,
    messages,
    temperature: task.temperature,
    max_completion_tokens: task.maxTokens,
  })
  trackUsage(task.name, completion.usage, userId)
  const content = completion.choices[0]?.message?.content
  if (content == null)
    throw new Error(`Task ${task.name}: model returned empty content`)
  return content as O
}

export async function streamTask<I>(
  task: AITask<I, string>,
  input: I,
  onDelta: (chunk: string) => void,
  userId?: number,
): Promise<{ full: string; usage: Usage | undefined }> {
  const messages = task.buildMessages(input)

  const stream = openai.chat.completions.stream({
    model: task.model,
    messages,
    temperature: task.temperature,
    max_completion_tokens: task.maxTokens,
    stream_options: { include_usage: true },
  })

  let full = ''
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) {
      full += delta
      onDelta(delta)
    }
  }

  const finalCompletion = await stream.finalChatCompletion()
  trackUsage(task.name, finalCompletion.usage, userId)
  return { full, usage: finalCompletion.usage }
}

export async function streamStructuredTask<I, O>(
  task: AITask<I, O>,
  input: I,
  onDelta: (chunk: string) => void,
  userId?: number,
): Promise<{ parsed: O; full: string; usage: Usage | undefined }> {
  if (!task.outputSchema) {
    throw new Error(`Task ${task.name}: streamStructuredTask requires outputSchema`)
  }

  const messages = task.buildMessages(input)

  const stream = openai.chat.completions.stream({
    model: task.model,
    messages,
    temperature: task.temperature,
    max_completion_tokens: task.maxTokens,
    stream_options: { include_usage: true },
    response_format: zodResponseFormat(task.outputSchema, task.name),
  })

  let full = ''
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? ''
    if (delta) {
      full += delta
      onDelta(delta)
    }
  }

  const finalCompletion = await stream.finalChatCompletion()
  trackUsage(task.name, finalCompletion.usage, userId)

  const parsed = finalCompletion.choices[0]?.message?.parsed
  if (parsed == null) {
    throw new Error(`Task ${task.name}: model returned no parsed output`)
  }
  return { parsed, full, usage: finalCompletion.usage }
}
