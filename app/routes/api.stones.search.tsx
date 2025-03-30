import { LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

/*
    const sortedResults = matchingStones.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      const aStartsWithTerm = aName.startsWith(term);
      const bStartsWithTerm = bName.startsWith(term);
      if (aStartsWithTerm && !bStartsWithTerm) return -1;
      if (!aStartsWithTerm && bStartsWithTerm) return 1;
      
      const aHasExactWord = aName.split(' ').some(word => word === term);
      const bHasExactWord = bName.split(' ').some(word => word === term);
      if (aHasExactWord && !bHasExactWord) return -1;
      if (!aHasExactWord && bHasExactWord) return 1;
      
      const aHasWordStartingWithTerm = aName.split(' ').some(word => word.startsWith(term));
      const bHasWordStartingWithTerm = bName.split(' ').some(word => word.startsWith(term));
      if (aHasWordStartingWithTerm && !bHasWordStartingWithTerm) return -1;
      if (!aHasWordStartingWithTerm && bHasWordStartingWithTerm) return 1;
      
      const aTermIndex = aName.indexOf(term);
      const bTermIndex = bName.indexOf(term);
      if (aTermIndex !== bTermIndex) return aTermIndex - bTermIndex;
      
      return aName.localeCompare(bName);
    });
*/

export async function loader({ request }: LoaderFunctionArgs) {
  const [, searchParams] = request.url.split("?");
  const cleanParams = new URLSearchParams(searchParams);
  const searchTerm = cleanParams.get("name");
  if (!searchTerm) {
    return Response.json({ stones: [] });
  }
  const stones = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, name
    FROM stones
     WHERE UPPER(name) LIKE UPPER(?)
     LIMIT 5`,
    [`%${searchTerm}%`]
  );
  
  return Response.json({ stones });
}
