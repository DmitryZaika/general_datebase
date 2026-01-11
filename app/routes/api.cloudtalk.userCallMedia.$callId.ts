import { type LoaderFunctionArgs, redirect } from 'react-router';
import { z } from "zod";
import type { User } from '~/utils/session.server';
import { getEmployeeUser } from '~/utils/session.server';

const callIdSchema = z.coerce.number().int().positive();

async function fetchCallMedia(callId: number, companyId: number): Promise<any> {
  const { BASE_URL, getAuthString } = await import("~/utils/cloudtalk.server");
  const auth = getAuthString(companyId);
  const fullUrl = `${BASE_URL}/calls/recordings/${callId}`;

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CloudTalk API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  let user: User;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const callId = callIdSchema.parse(params.callId);
  return fetchCallMedia(callId, user.company_id);
}
