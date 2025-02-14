import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

export function ImageCard({
  children,
  fieldList,
  title,
}: {
  children: JSX.Element;
  fieldList?: Record<string, number | null | string>;
  title: string;
}) {
  return (
    <Card className="w-full max-w-sm">
      <div className=" relative">{children}</div>
      <CardHeader className="grid gap-1 p-[2px]">
        <CardTitle className="text-md  text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-0 px-1 text-xs">
        {fieldList &&
          Object.entries(fieldList).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
