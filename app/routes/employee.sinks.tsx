import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
import { ImageCard } from "~/components/organisms/ImageCard";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { useState } from "react";

interface Sink {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  height: number | null;
  width: number | null;
  amount: number | null;
}

const customOrder = [
  "stainless 18 gauge",
  "stainless 16 gauge",
  "granite composite",
  "ceramic",
];

function customSortType(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);

  const sinks = await selectMany<Sink>(
    db,
    `
      SELECT id, name, type, url, is_display, height, width, amount
      FROM sinks
      WHERE company_id = ? AND is_display = 1
      ORDER BY name ASC
    `,
    [user.company_id]
  );

  return { sinks };
};

function InteractiveCard({
  sink,
  setCurrentId,
  sinkType,
}: {
  sink: Sink;
  setCurrentId: (value: number, type: string) => void;
  sinkType: string;
}) {
  const displayedAmount = sink.amount && sink.amount > 0 ? sink.amount : "—";
  const displayedWidth = sink.width && sink.width > 0 ? sink.width : "—";
  const displayedHeight = sink.height && sink.height > 0 ? sink.height : "—";

  return (
    <div
      key={sink.id}
      className="relative group w-full"
      onAuxClick={(e) => {
        if (e.button === 1 && sink.url) {
          e.preventDefault();
          window.open(sink.url, "_blank");
        }
      }}
    >
      <ImageCard
        fieldList={{
          Amount: `${displayedAmount}`,
          Size: `${displayedWidth} x ${displayedHeight}`,
        }}
        title={sink.name}
      >
        <img
          src={sink.url || "/placeholder.png"}
          alt={sink.name || "Sink Image"}
          className="object-cover w-full h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none"
          loading="lazy"
          onClick={() => setCurrentId(sink.id, sinkType)}
        />
      </ImageCard>
      {displayedAmount === "—" && (
        <div className="absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
          <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
            Out of Stock
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);

  const handleSetCurrentId = (id: number | undefined, type?: string) => {
    setCurrentId(id);
    if (type) {
      setActiveType(type);
    } else if (id === undefined) {
      setActiveType(undefined);
    }
  };

  const sinkList = sinks.reduce((acc: { [key: string]: Sink[] }, sink) => {
    if (!acc[sink.type]) {
      acc[sink.type] = [];
    }
    acc[sink.type].push(sink);
    return acc;
  }, {});

  return (
    <Accordion type="single" defaultValue="sinks" className="pt-24 sm:pt-0">
      <AccordionItem value="sinks">
        <AccordionContent>
          <Accordion type="multiple">
            {Object.keys(sinkList)
              .sort(customSortType)
              .map((type) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ModuleList>
                      <SuperCarousel
                        currentId={currentId}
                        setCurrentId={handleSetCurrentId}
                        images={sinkList[type]}
                        stoneType={type}
                        activeType={activeType}
                      />
                      {sinkList[type]
                        .sort((a, b) => {
                          const aAmount = a.amount ?? 0;
                          const bAmount = b.amount ?? 0;
                          if (aAmount === 0 && bAmount !== 0) return 1;
                          if (aAmount !== 0 && bAmount === 0) return -1;
                          return a.name.localeCompare(b.name);
                        })
                        .map((sink) => (
                          <InteractiveCard
                            key={sink.id}
                            sink={sink}
                            setCurrentId={handleSetCurrentId}
                            sinkType={type}
                          />
                        ))}
                    </ModuleList>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
