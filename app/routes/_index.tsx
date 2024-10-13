import { useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import ModuleList from "../components/ModuleList";
import { Title } from "../components/Title";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

interface ImageProps {
  name?: string;
  src: string;
  className?: string;
}

interface SupplierProps {
  name?: string;
  phone: string;
  notes: string;
  email: string;
  website: string;
  supplierName: string;
}

interface DocumentProps {
  src: string;
  children: JSX.Element;
}

export const loader = async () => {
  const stoneList = {
    granite: [
      { name: "Aghata Premium" },
      { name: "American Black" },
      { name: "Andorra White" },
      { name: "Atlas" },
      { name: "Azul Nuevo" },
      { name: "Black Pearl" },
      { name: "Bianco Antico" },
    ],
    quartz: [
      { name: "Calacatta Lazio" },
      { name: "Calacatta Miraggio Cove" },
      { name: "Calacatta Roma" },
      { name: "Crystallo" },
    ],
    marble: [
      { name: "Fantasy Brown" },
      { name: "Fantasy River" },
      { name: "Mont Blanc" },
    ],
    quartzite: [
      { name: "Cosmopolitan" },
      { name: "Dumont" },
      { name: "Sea Pearl" },
      { name: "Polaris" },
    ],
  };

  const sinkList = [
    { name: "Granite Composite Sinks" },
    { name: "Stainless Steel Sinks 16 Gauge" },
    { name: "Stainless Steel Sinks 18 Gauge" },
    { name: "Ceramic Sinks" },
  ];

  const supplierList = [
    {
      website: "https://www.msisurfaces.com",
      supplierName: "MSI Surface",
      name: "Scott Alexander",
      phone: "(317) 614-3700",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://www.montsurfaces.com",
      supplierName: "Mont Surfaces",
      name: "Gina Bohannon",
      phone: "(317) 875-5800",
      email: "gb@montsurfaces.com",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://tritonstone.com",
      supplierName: "Triton Stone",
      name: "Aaron Heath - Slabs",
      phone: "(317) 644-1200",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://www.stone-design.com",
      supplierName: "Stone Design",
      name: "Isaac Martinez",
      phone: "(317) 546-2300",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://www.stonemartmarblegranite.com",
      supplierName: "Stone Mart Marble & Granite",
      name: "Anthony",
      phone: "(317) 991-4253",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://northstarsurfaces.com",
      supplierName: "North Star Surfaces",
      name: "Anthony",
      phone: "(463) 777-6779",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website:
        "https://xpresscargo365-my.sharepoint.com/:p:/g/personal/stephanie_plutusmarble_com/EYacC2TsdVtDqNqVegBJj04BQMxhlJShsUytpf_1jgoyiQ?rtime=iEMfbfHQ3Eg",
      supplierName: "Plutus",
      name: "",
      phone: "",
      email: "",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "http://www.stonebasyx.com",
      supplierName: "Stone Basyx",
      name: "Dinarte",
      phone: "336-529-4350",
      email: "dcarsoso@stonebasyx.com",
      notes: "Has only 3cm slabs",
    },
    {
      website: "http://www.stonelandinc.com",
      supplierName: "Stoneland Inc",
      name: "Jesse",
      phone: "859-737-7625",
      email: "jesse@stonelandinc.com",
      notes: "Supplier in Indianapolis",
    },
    {
      website: "https://kivastonech.stoneprofitsweb.com",
      supplierName: "Kiva Stone",
      name: "",
      phone: "",
      email: "",
      notes: "Warehouse in Chicago, keep only 3cm",
    },
  ];

  const supportList = [
    { name: "Flat Supports" },
    { name: "Flat Supports Image 1" },
    { name: "Flat Supports Image 2" },
    { name: "L Supports Big" },
    { name: "L Supports Big Image" },
    { name: "L Supports Image 1" },
    { name: "L Supports" },
  ];

  const documentList = [
    { name: "Care and Maintenance" },
    { name: "Contract" },
    { name: "FHBS Reminders" },
    { name: "Pick Up Form" },
    { name: "Post Install Check List" },
    { name: "Template Fill In" },
    { name: "Template Reminders" },
    { name: "Warranty" },
  ];

  const imageList = [
    { name: "Stainless Steel Sinks" },
    { name: "Granite Composite Sinks" },
    { name: "Edges Example" },
    { name: "Special 1999 Granite" },
    { name: "Special 2499 Quartz" },
    { name: "Special 3299 Granite" },
    { name: "Special 3299 Quartz" },
    { name: "Special 599$" },
  ];

  return json({
    sinkList,
    stoneList,
    supplierList,
    supportList,
    documentList,
    imageList,
  });
};

export const meta: MetaFunction = () => {
  return [
    { title: "Granite Depot Database" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

function Image({ className, src, name }: ImageProps) {
  return (
    <div className="">
      <img
        src={src}
        alt={name}
        className={`w-16  ${className === undefined ? "" : className}`}
        loading="lazy"
      />
      <p className="text-center font-bold select-text">{name}</p>
    </div>
  );
}

function Document({ children, src }: DocumentProps) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="text-center">
      {children}
    </a>
  );
}

function Supplier({
  name = "",
  phone,
  email,
  notes,
  website,
  supplierName,
}: SupplierProps) {
  return (
    <li>
      <span className="supplier">
        <a rel="noreferrer" href={website} target="_blank">
          {supplierName}
        </a>
      </span>
      <img src="./images/donde.webp" alt="Checkmark" className="checkbox" />
      <span className="name"> {name}</span>
      <span className="phone">{phone}</span>
      <span className="email">{email} </span>
      <span className="notes">{notes}</span>
    </li>
  );
}

function getSourceName(source: string, name: string) {
  const cleanName = name.toLowerCase().replace(/\s+/g, "_");

  return `./images/${source}/${cleanName}.webp`;
}

const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

function Stones({
  stoneList,
}: {
  stoneList: {
    granite: {
      name: string;
    }[];
    quartz: {
      name: string;
    }[];
    marble: {
      name: string;
    }[];
    quartzite: {
      name: string;
    }[];
  };
}) {
  const [stones, setStones] = useState(false);

  return (
    <div className="border-2 border-sky-500 select-none">
      <h2 className="cursor-pointer " onClick={() => setStones(!stones)}>
        Stones
      </h2>
      {stones && (
        <div className="cursor-pointer">
          <ul>
            {Object.keys(stoneList).map((source) => (
              <ModuleList key={source} name={capitalizeFirstLetter(source)}>
                <div className="image-gallery flex ">
                  {stoneList[
                    source as "granite" | "quartz" | "quartzite" | "marble"
                  ].map((item: { name: string }) => (
                    <Image
                      key={item.name}
                      src={getSourceName(`stones/${source}`, item.name)}
                      name={item.name}
                    />
                  ))}
                </div>
              </ModuleList>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Sinks({ sinkList }: { sinkList: { name: string }[] }) {
  const [sinks, setSinks] = useState(false);

  return (
    <div className="border-2 border-sky-500 select-none">
      <h2 className="cursor-pointer" onClick={() => setSinks(!sinks)}>
        Sinks
      </h2>
      {sinks && (
        <div className="cursor-pointer">
          <ul>
            {sinkList.map((item) => (
              <ModuleList
                key={item.name}
                name={capitalizeFirstLetter(item.name)}
              >
                <div className="image-gallery">
                  <Image
                    key={item.name}
                    src={getSourceName("sinks", item.name)}
                    name={item.name}
                  />
                </div>
              </ModuleList>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Suppliers({
  supplierList,
}: {
  supplierList: {
    name: string;
    website: string;
    supplierName: string;
    phone: string;
    email: string;
    notes: string;
  }[];
}) {
  const [suppliers, setSuppliers] = useState(false);

  return (
    <div className="border-2 border-sky-500 select-none">
      <h2 className="cursor-pointer " onClick={() => setSuppliers(!suppliers)}>
        Suppliers
      </h2>
      {suppliers && (
        <div className="cursor-pointer">
          <ul className="warehouse-list">
            {supplierList.map((supplierList, index) => (
              <Supplier
                key={index}
                website={supplierList.website}
                supplierName={supplierList.supplierName}
                name={supplierList.name}
                phone={supplierList.phone}
                email={supplierList.email}
                notes={supplierList.notes}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Supports({ supportList }: { supportList: { name: string }[] }) {
  const [supports, setSupports] = useState(false);

  return (
    <div className="border-2 border-sky-500 select-none">
      <h2
        className="module-title cursor-pointer"
        onClick={() => setSupports(!supports)}
      >
        Supports
      </h2>
      {supports && (
        <div className="cursor-pointer">
          <div className="supports-gallery text-center ">
            <ul className="flex">
              {supportList.map((item, index) => (
                <Image
                  key={index}
                  src={getSourceName("supports", item.name)}
                  name={item.name}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Documents({ documentList }: { documentList: { name: string }[] }) {
  const [documents, setDocuments] = useState(false);

  return (
    <Title text="Documents" setUseState={setDocuments} state={documents}>
      {documents && (
        <div className="cursor-pointer flex">
          {documentList.map((item, index) => (
            <Document key={index} src={getSourceName("documents", item.name)}>
              <Image
                src={getSourceName("documents", item.name)}
                name={item.name}
              />
            </Document>
          ))}
        </div>
      )}
    </Title>
  );
}

function Images({ imageList }: { imageList: { name: string }[] }) {
  const [images, setImages] = useState(false);

  return (
    <Title text="Images" setUseState={setImages} state={images}>
      {images && (
        <div className="cursor-pointer">
          <ul className="flex">
            {imageList.map((image, index) => (
              <Image
                key={index}
                src={getSourceName("images", image.name)}
                name={image.name}
              />
            ))}
          </ul>
        </div>
      )}
    </Title>
  );
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>Granite Depot Database</h1>
      <section className="modules">
        <Stones stoneList={data.stoneList} />
        <Sinks sinkList={data.sinkList} />
        <Suppliers supplierList={data.supplierList} />
        <Supports supportList={data.supportList} />
        <Documents documentList={data.documentList} />
        <Images imageList={data.imageList} />
      </section>
    </main>
  );
}
