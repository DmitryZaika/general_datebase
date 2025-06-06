// app/routes/api.address-autocomplete.ts
import { data, type LoaderFunctionArgs } from "react-router";
import { z } from "zod";

const qs = z.object({ q: z.string().min(3).max(100) });
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY!;

export async function loader({ request }: LoaderFunctionArgs) {
  const { q } = qs.parse(Object.fromEntries(new URL(request.url).searchParams));

  const url = new URL("https://places.googleapis.com/v1/places:autocomplete");

  const gRes = await fetch(url, { method: 'post', signal: request.signal, headers: {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_KEY,
  }, body: JSON.stringify({
    input: q,
    languageCode: "en",
    includedRegionCodes: ["US"]
  }) });
  if (!gRes.ok) {
    const txt = await gRes.text();
    console.error("Places API error:", gRes.status, txt);
    return data({ error: "Google Places error" }, { status: 502 });
  }

  const gJson = await gRes.json() as {
    suggestions: { placePrediction: { text: string; placeId: string } }[];
  };

  // Optionally fetch zip codes for each suggestion
  const suggestionsWithZipCodes = await Promise.all(
    gJson.suggestions.map(async (s) => {
      try {
        // Fetch place details to get zip code
        const detailsUrl = new URL(`https://places.googleapis.com/v1/places/${s.placePrediction.placeId}`);
        const detailsRes = await fetch(detailsUrl, {
          method: 'get',
          signal: request.signal,
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_KEY,
            "X-Goog-FieldMask": "addressComponents"
          }
        });

        if (detailsRes.ok) {
          const detailsJson = await detailsRes.json() as {
            addressComponents: Array<{
              longText: string;
              shortText: string;
              types: string[];
            }>;
          };

          const zipCode = detailsJson.addressComponents?.find(component => 
            component.types.includes('postal_code')
          )?.longText;

          return {
            description: s.placePrediction.text,
            place_id: s.placePrediction.placeId,
            zip_code: zipCode,
          };
        }
      } catch (error) {
        console.error("Error fetching place details:", error);
      }

      // Fallback if details fetch fails
      return {
        description: s.placePrediction.text,
        place_id: s.placePrediction.placeId,
        zip_code: null,
      };
    })
  );

  return data({
    suggestions: suggestionsWithZipCodes,
  });
}

