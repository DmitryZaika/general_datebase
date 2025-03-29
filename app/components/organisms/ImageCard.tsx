// app/components/organisms/ImageCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Link, useLocation } from "react-router";

import type { JSX } from "react";

export function ImageCard({
  children,
  fieldList,
  title,
  itemId,
  type,
  price,
  supplier,
}: {
  children: JSX.Element;
  fieldList?: Record<string, number | null | string>;
  title: string;
  itemId?: number;
  type: string;
  price?: number;
  supplier?: string;
}) {
  const location = useLocation();
  return (
    <Card className="w-full max-w-sm ">
      <div className="relative">{children}</div>

      <CardHeader className="grid gap-1 p-[2px]">
        <CardTitle className="text-md text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-1 text-xs">
        <Link to={`${type}/${itemId}${location.search}`}>
          {fieldList &&
            Object.entries(fieldList).map(([key, value]) => (
              <div key={key}>
                <p key={key}>
                  {key}: {value}
                </p>
                <p>{price}</p>
                <p>{supplier}</p>
              </div>
            ))}
        </Link>
      </CardContent>
    </Card>
  );
}
