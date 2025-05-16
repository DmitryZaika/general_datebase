import React, { useState } from "react";
import { Stage, Layer, Line } from "react-konva";
import * as polygonClipping from "polygon-clipping";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Send } from "lucide-react";

/** Типы и константы */
export type Point = { x: number; y: number };
export type Polygon = Point[];

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const initialSlab: Polygon = [
  { x: 0, y: 0 },
  { x: CANVAS_WIDTH, y: 0 },
  { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
  { x: 0, y: CANVAS_HEIGHT },
];

/**
 * Разрезает полигоны линией и возвращает новые полигоны.
 * TODO: Реализовать на polygon‑clipping.
 */
function splitShapesWithLine(shapes: Polygon[], line: [Point, Point]): Polygon[] {
  /* Пример, как это может быть реализовано:
  const linePoly = [
    [ [line[0].x, line[0].y], [line[1].x, line[1].y] ]
  ];
  const newShapes: Polygon[] = [];
  for (const poly of shapes) {
    const result = polygonClipping.splitPolygon(polyAsArray, linePoly);
    // Преобразовать результат в Point[][] и push в newShapes
  }
  return newShapes;
  */
  return shapes; // заглушка
}

/** Главный компонент */
export default function SlabCuttingApp() {
  const [shapes, setShapes] = useState<Polygon[]>([initialSlab]);
  const [startPoint, setStartPoint] = useState<Point | null>(null); // первая точка линии
  const [cursorPos, setCursorPos] = useState<Point | null>(null); // позиция курсора для предпросмотра

  /** Клик по сцене */
  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (!startPoint) {
      // ставим первую точку линии
      setStartPoint(pointer);
    } else {
      // вторая точка → режем
      const newLine: [Point, Point] = [startPoint, pointer];
      const newShapes = splitShapesWithLine(shapes, newLine);
      setShapes(newShapes);
      setStartPoint(null);
      setCursorPos(null);
    }
  };

  /** Движение мыши для предпросмотра */
  const handleMouseMove = (e: any) => {
    if (!startPoint) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    setCursorPos(pointer);
  };

  /** Отправка результата */
  const sendToBackend = async () => {
    try {
      await fetch("/api/slabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shapes),
      });
      alert("Отправлено");
    } catch (err) {
      console.error(err);
      alert("Ошибка отправки");
    }
  };

  /** Рендер */
  return (
    <Card className="m-4 p-4 space-y-4 shadow-lg rounded-2xl">
      <CardContent className="space-y-4">
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border rounded-2xl shadow-inner bg-white"
          onClick={handleStageClick}
          onMouseMove={handleMouseMove}
        >
          <Layer>
            {/* Рисуем существующие полигоны */}
            {shapes.map((poly, idx) => (
              <Line
                key={idx}
                points={poly.flatMap((p) => [p.x, p.y])}
                closed
                fill="#f3f4f6" // gray‑100
                stroke="#1f2937" // gray‑800
                strokeWidth={1}
              />
            ))}

            {/* Линия предпросмотра */}
            {startPoint && cursorPos && (
              <Line
                points={[startPoint.x, startPoint.y, cursorPos.x, cursorPos.y]}
                stroke="#ef4444" // red‑500
                strokeWidth={2}
                dash={[4, 4]}
              />
            )}
          </Layer>
        </Stage>

        <Button onClick={sendToBackend} className="w-full gap-2">
          <Send size={16} /> Отправить на бэкенд
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Шаги интеграции:
 * 1. yarn add react-konva konva polygon-clipping lucide-react @shadcn/ui tailwindcss
 * 2. Подключите <SlabCuttingApp /> в своём приложении.
 * 3. Реализуйте splitShapesWithLine.
 * 4. Настройте /api/slabs на сервере.
 */

