import { useState } from "react";
import type { MetaFunction } from "@remix-run/node";
import ModuleList from "../components/ModuleList";
import { Title } from "../components/Title";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import BlockList from "~/components/BlockList";
import { PageLayout } from "~/components/PageLayout";
import { ImageList } from "~/components/ImageList";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

interface ImageProps {
  name?: string;
  src: string;
  className?: string;
}

interface Supplier {
  id: number;
  supplier_name: string;
  manager?: string;
  phone?: string;
  notes?: string;
  email?: string;
  website?: string;
}

interface DocumentProps {
  src: string;
  children: JSX.Element;
}

interface Support {
  id: number;
  name: string;
}

interface Stone {
  id: number;
  name: string;
  type: string;
}

interface Sink {
  id: number;
  name: string;
}

interface Document {
  id: number;
  name: string;
  src?: string;
}

interface ImageData {
  id: number;
  name: string;
}

const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

function getSourceName(source: string, name: string) {
  const cleanName = name.toLowerCase().replace(/\s+/g, "_").replace(/\$/g, "");
  return `./images/${source}/${cleanName}.webp`;
}

export const loader = async () => {
  const stoneList = await selectMany<Stone>(
    db,
    "select id, name, type from stones"
  );
  const sinkList = await selectMany<Sink>(db, "select id, name from sinks");
  const supplierList = await selectMany<Supplier>(
    db,
    "select id, website, manager, supplier_name, phone, email from suppliers"
  );
  const supportList = await selectMany<Support>(
    db,
    "select id, name from supports"
  );

  const documentList = await selectMany<Document>(
    db,
    "SELECT id, name FROM documents"
  );

  const imageList = await selectMany<ImageData>(
    db,
    "SELECT id, name FROM images"
  );

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
          className={`w-full flex-wrap  h-auto border-2
             border-blue-500 
             rounded
              cursor-pointer 
             transition 
             duration-300 
             ease-in-out
              transform
              hover:scale-105
               hover:shadow-lg
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
            className="w-auto h-[90%] mx-auto my-auto"
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

function SupplierInfo({
  supplier_name,
  website,
  manager,
  phone,
  email,
  notes,
}: Supplier) {
  return (
    <li className="grid grid-cols-6 gap-2 p-4 mb-4 font-sans text-base text-gray-800 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
      <span className="col-span-2 text-left font-bold">
        <a
          rel="noreferrer"
          href={website}
          target="_blank"
          className="text-blue-600 hover:underline"
        >
          {supplier_name}
        </a>
      </span>
      <img
        src="./images/donde.webp"
        alt="Checkmark"
        className="w-5 h-5 mx-auto"
      />
      <span>{manager}</span>
      <span>{phone}</span>
      <span>{email}</span>
      {/* Notes column can be hidden on smaller screens if needed */}
      <span className="col-span-6 mt-1 text-sm text-gray-600">{notes}</span>
    </li>
  );
}

function Stones({ values }: { values: Stone[] }) {
  const [stonesOpen, setStonesOpen] = useState(false);

  const stoneList: { [key: string]: { name: string; id: number }[] } =
    values.reduce(
      (
        acc: { [key: string]: { name: string; id: number }[] },
        stone: Stone
      ) => {
        if (!acc[stone.type]) {
          acc[stone.type] = [];
        }

        acc[stone.type].push({ name: stone.name, id: stone.id });

        return acc;
      },
      {}
    );

  return (
    <Title text="Stones" state={stonesOpen} setState={setStonesOpen}>
      <ul className="mt-1 pt-2">
        {Object.keys(stoneList).map((source) => (
          <ModuleList key={source} name={capitalizeFirstLetter(source)}>
            <ImageList>
              {stoneList[
                source as "granite" | "quartz" | "quartzite" | "marble"
              ].map((item) => (
                <Image
                  key={item.id}
                  src={getSourceName(`stones/${source}`, item.name)}
                  name={item.name}
                />
              ))}
            </ImageList>
          </ModuleList>
        ))}
      </ul>
    </Title>
  );
}

function Sinks({ sinkList }: { sinkList: Sink[] }) {
  const [sinksOpen, setSinksOpen] = useState(false);

  return (
    <Title text="Sinks" state={sinksOpen} setState={setSinksOpen}>
      <BlockList>
        {sinkList.map((item) => (
          <ModuleList key={item.id} name={capitalizeFirstLetter(item.name)}>
            <ImageList>
              <Image
                key={item.id}
                src={getSourceName("sinks", item.name)}
                name={item.name}
              />
            </ImageList>
          </ModuleList>
        ))}
      </BlockList>
    </Title>
  );
}

function Suppliers({ supplierList }: { supplierList: Supplier[] }) {
  const [suppliersOpen, setSuppliersOpen] = useState(false);

  return (
    <Title text="Suppliers" state={suppliersOpen} setState={setSuppliersOpen}>
      <BlockList>
        {supplierList.map((supplier) => (
          <SupplierInfo key={supplier.id} {...supplier} />
        ))}
      </BlockList>
    </Title>
  );
}

function Supports({ supportList }: { supportList: Support[] }) {
  const [supportsOpen, setSupportsOpen] = useState(false);

  return (
    <Title text="Supports" state={supportsOpen} setState={setSupportsOpen}>
      <ImageList>
        {supportList.map((item) => (
          <Image
            key={item.id}
            src={getSourceName("supports", item.name)}
            name={item.name}
          />
        ))}
      </ImageList>
    </Title>
  );
}

function Documents({ documentList }: { documentList: Document[] }) {
  const [documentsOpen, setDocumentsOpen] = useState(false);

  return (
    <Title text="Documents" state={documentsOpen} setState={setDocumentsOpen}>
      <ImageList>
        {documentList.map((item) => (
          <Document key={item.id} src={getSourceName("documents", item.name)}>
            <Image
              src={getSourceName("documents", item.name)}
              name={item.name}
            />
          </Document>
        ))}
      </ImageList>
    </Title>
  );
}

function Images({ imageList }: { imageList: ImageData[] }) {
  const [imagesOpen, setImagesOpen] = useState(false);

  return (
    <Title text="Images" state={imagesOpen} setState={setImagesOpen}>
      <ImageList>
        {imageList.map((image) => (
          <Image
            key={image.id}
            src={getSourceName("images", image.name)}
            name={image.name}
          />
        ))}
      </ImageList>
    </Title>
  );
}

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <PageLayout title="Granite Depot DataBase">
      <Stones values={data.stoneList} />
      <Sinks sinkList={data.sinkList} />
      <Suppliers supplierList={data.supplierList} />
      <Supports supportList={data.supportList} />
      <Documents documentList={data.documentList} />
      <Images imageList={data.imageList} />
    </PageLayout>
  );
}
