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
  disabled,
}: {
  children: JSX.Element;
  fieldList?: Record<string, number | null | string>;
  title: string;
  itemId?: number;
  type?: string;
  price?: number;
  supplier?: string;
  disabled?: boolean;
}) {
  const location = useLocation();
  return (
    <Card className="w-full max-w-sm ">
      <div className="relative">{children}</div>

      <CardHeader className="grid gap-1 p-[2px]">
        <CardTitle className="text-md text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-1 text-xs">
        {(() => {
          const content = (
            <>
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
            </>
          );
          
          if (!disabled && itemId && type) {
            return <Link to={`${type}/${itemId}${location.search}`}>{content}</Link>;
          }
          
          return content;
        })()}
      </CardContent>
    </Card>
  );
}
