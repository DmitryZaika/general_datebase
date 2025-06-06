import { data, LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { StoneSearchResult } from "~/types";
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
  const showSoldOut = cleanParams.get("show_sold_out") === "true";

  if (!searchTerm) {
    return Response.json({ stones: [] });
  }

  let query = `SELECT s.id, s.type, s.width, s.length, s.name, s.url, s.retail_price, s.cost_per_sqft, s.is_display,
            CAST(SUM(CASE WHEN si.id IS NOT NULL AND si.sale_id IS NULL AND si.cut_date IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) AS available,
            CAST(COUNT(si.id) AS UNSIGNED) AS amount
    FROM main.stones s
    LEFT JOIN main.slab_inventory AS si ON si.stone_id = s.id
    WHERE UPPER(s.name) LIKE UPPER(?)
    AND s.is_display = 1
    GROUP BY s.id, s.type, s.name, s.url, s.width, s.length, s.retail_price, s.cost_per_sqft, s.is_display`;

  if (!showSoldOut) {
    query += `\nHAVING available > 0`;
  }

  query += `\nORDER BY 
      CASE 
        WHEN UPPER(s.name) LIKE UPPER(?) THEN 0  
        WHEN UPPER(s.name) LIKE UPPER(?) THEN 1  
        ELSE 2                                  
      END,
      s.name ASC
    LIMIT 5`;

  const stones = await selectMany<StoneSearchResult>(db, query, [
    `%${searchTerm}%`,
    `${searchTerm}%`,
    `% ${searchTerm} %`,
  ]);

  return data({ stones });
}
