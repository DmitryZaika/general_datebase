import { useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import ModuleList from "../components/ModuleList";
import { Title } from "../components/Title";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import BlockList from "~/components/BlockList";
import { PageLayout } from "~/components/PageLayout";

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

export function Image({ className = "", src, name }: ImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="flex flex-col items-center">
        <img
          src={src}
          alt={name}
          className={`w-44 h-auto border-2
             border-blue-500 
             rounded cursor-pointer 
             transition duration-300 
             ease-in-out transform
              hover:scale-110 hover:shadow-lg
               hover:border-blue-500
                hover:bg-gray-300 ${className}`}
          loading="lazy"
          onClick={handleImageClick}
        />
        <p className="text-center font-bold select-text">{name}</p>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={closeModal}
        >
          <span
            className="absolute top-4 right-8 text-white text-4xl font-bold cursor-pointer"
            onClick={closeModal}
          >
            &times;
          </span>
          <img
            src={src}
            alt={name}
            className="w-1/2 h-auto mx-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
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
    <li className="grid grid-cols-6 gap-2 p-4 mb-4 font-sans text-base text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
      <span className="col-span-2 text-left font-bold">
        <a
          rel="noreferrer"
          href={website}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          {supplierName}
        </a>
      </span>
      <img
        src="./images/donde.webp"
        alt="Checkmark"
        className="w-5 h-5 mx-auto"
      />
      <span className="">{name}</span>
      <span className="">{phone}</span>
      <span className="">{email}</span>
      {/* Notes column can be hidden on smaller screens if needed */}
      <span className="col-span-6 mt-1 text-sm text-gray-600">{notes}</span>
    </li>
  );
}

function getSourceName(source: string, name: string) {
  const cleanName = name.toLowerCase().replace(/\s+/g, "_").replace("$", "");
  return `./images/${source}/${cleanName}.webp`;
}

const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

function Stones({
  stoneList,
}: {
  stoneList: {
    granite: { name: string }[];
    quartz: { name: string }[];
    marble: { name: string }[];
    quartzite: { name: string }[];
  };
}) {
  const [stonesOpen, setStonesOpen] = useState(false);

  return (
    <Title text="Stones" state={stonesOpen} setState={setStonesOpen}>
      <ul className="mt-1 pt-2">
        {Object.keys(stoneList).map((source) => (
          <ModuleList key={source} name={capitalizeFirstLetter(source)}>
            <div className="mt-5 p-2.5 border border-gray-300 rounded bg-gray-100 flex flex-wrap gap-2.5 justify-start overflow-x-auto">
              {stoneList[
                source as "granite" | "quartz" | "quartzite" | "marble"
              ].map((item) => (
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
    </Title>
  );
}

function Sinks({ sinkList }: { sinkList: { name: string }[] }) {
  const [sinksOpen, setSinksOpen] = useState(false);

  return (
    <Title text="Sinks" state={sinksOpen} setState={setSinksOpen}>
      <BlockList>
        {sinkList.map((item) => (
          <ModuleList key={item.name} name={capitalizeFirstLetter(item.name)}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Image
                key={item.name}
                src={getSourceName("sinks", item.name)}
                name={item.name}
              />
            </div>
          </ModuleList>
        ))}
      </BlockList>
    </Title>
  );
}

function Suppliers({ supplierList }: { supplierList: SupplierProps[] }) {
  const [suppliersOpen, setSuppliersOpen] = useState(false);

  return (
    <Title text="Suppliers" state={suppliersOpen} setState={setSuppliersOpen}>
      <BlockList>
        {supplierList.map((supplier, index) => (
          <Supplier key={index} {...supplier} />
        ))}
      </BlockList>
    </Title>
  );
}

function Supports({ supportList }: { supportList: { name: string }[] }) {
  const [supportsOpen, setSupportsOpen] = useState(false);

  return (
    <Title text="Supports" state={supportsOpen} setState={setSupportsOpen}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
        {supportList.map((item, index) => (
          <Image
            key={index}
            src={getSourceName("supports", item.name)}
            name={item.name}
          />
        ))}
      </div>
    </Title>
  );
}

function Documents({ documentList }: { documentList: { name: string }[] }) {
  const [documentsOpen, setDocumentsOpen] = useState(false);

  return (
    <Title text="Documents" state={documentsOpen} setState={setDocumentsOpen}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
        {documentList.map((item, index) => (
          <Document key={index} src={getSourceName("documents", item.name)}>
            <Image
              src={getSourceName("documents", item.name)}
              name={item.name}
            />
          </Document>
        ))}
      </div>
    </Title>
  );
}

function Images({ imageList }: { imageList: { name: string }[] }) {
  const [imagesOpen, setImagesOpen] = useState(false);

  return (
    <Title text="Images" state={imagesOpen} setState={setImagesOpen}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
        {imageList.map((image, index) => (
          <Image
            key={index}
            src={getSourceName("images", image.name)}
            name={image.name}
          />
        ))}
      </div>
    </Title>
  );
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Granite Depot DataBase">
      <Stones stoneList={data.stoneList} />
      <Sinks sinkList={data.sinkList} />
      <Suppliers supplierList={data.supplierList} />
      <Supports supportList={data.supportList} />
      <Documents documentList={data.documentList} />
      <Images imageList={data.imageList} />
    </PageLayout>
  );
}
