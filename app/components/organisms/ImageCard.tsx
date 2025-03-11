// app/components/organisms/ImageCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Link } from "react-router";

import type { JSX } from "react";

export function ImageCard({
  children,
  fieldList,
  title,
  stoneId,
}: {
  children: JSX.Element;
  fieldList?: Record<string, number | null | string>;
  title: string;
  stoneId?: number;
}) {
  return (
    <Card className="w-full max-w-sm hover:cursor-pointer">
      <div className="relative">{children}</div>

      <CardHeader className="grid gap-1 p-[2px]">
        <CardTitle className="text-md text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-1 text-xs">
        <Link to={`slabs/${stoneId}`}>
          {fieldList &&
            Object.entries(fieldList).map(([key, value]) => (
              <p key={key}>
                {key}: {value}
              </p>
            ))}
        </Link>
      </CardContent>
    </Card>
  );
}
