import { data, type LoaderFunctionArgs } from "react-router";
import { z } from "zod";

const qs = z.object({ place_id: z.string().min(1) });
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function loader({ request }: LoaderFunctionArgs) {
  const { place_id } = qs.parse(Object.fromEntries(new URL(request.url).searchParams));

  const url = new URL(`https://places.googleapis.com/v1/places/${place_id}`);

  const gRes = await fetch(url, { 
    method: 'get', 
    signal: request.signal, 
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents"
    }
  });

  if (!gRes.ok) {
    const txt = await gRes.text();
    console.error("Places Details API error:", gRes.status, txt);
    return data({ error: "Google Places Details error" }, { status: 502 });
  }

  const gJson = await gRes.json() as {
    id: string;
    displayName: { text: string };
    formattedAddress: string;
    addressComponents: Array<{
      longText: string;
      shortText: string;
      types: string[];
    }>;
  };

  // Extract zip code from address components
  const zipCode = gJson.addressComponents?.find(component => 
    component.types.includes('postal_code')
  )?.longText;

  // Extract city, state, country
  const city = gJson.addressComponents?.find(component => 
    component.types.includes('locality')
  )?.longText;

  const state = gJson.addressComponents?.find(component => 
    component.types.includes('administrative_area_level_1')
  )?.shortText;

  const country = gJson.addressComponents?.find(component => 
    component.types.includes('country')
  )?.shortText;

  return data({
    place_id: gJson.id,
    name: gJson.displayName?.text,
    formatted_address: gJson.formattedAddress,
    zip_code: zipCode,
    city: city,
    state: state,
    country: country,
    address_components: gJson.addressComponents
  });
} 