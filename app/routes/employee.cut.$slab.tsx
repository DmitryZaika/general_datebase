
import React, { useState } from "react";
import { Stage, Layer, Line, Shape } from "react-konva";
import * as polygonClipping from "polygon-clipping";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Send } from "lucide-react";

/** Типы **/
export type Point = { x: number; y: number };
export type Polygon = Point[];

/** Начальный «слэб» — весь холст */
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const initialSlab: Polygon = [
  { x: 0, y: 0 },
  { x: CANVAS_WIDTH, y: 0 },
  { x: CANVAS_WIDTH, y: CANVAS_HEIGHT },
  { x: 0, y: CANVAS_HEIGHT },
];

/**
 * Разделяет полигоны линией и возвращает новые полигоны.
 * Реализация демонстрационная: если линия не пересекает полигон, он остаётся.
 * TODO: заменить на точный алгоритм с использованием polygon-clipping.
 */
function splitShapesWithLine(shapes: Polygon[], line: [Point, Point]): Polygon[] {
  // Пример вызова polygonClipping:
  // const result = polygonClipping.splitPolygonWithLine(shapesAsArrays, lineAsArrays);
  // Преобразовать результат обратно в массив Polygon.
  // Пока возвращаем исходное.
  return shapes;
}

/** Главный компонент */
export default function SlabCutting() {
  const [shapes, setShapes] = useState<Polygon[]>([initialSlab]);
  const [tempLine, setTempLine] = useState<Point[]>([]);

  /** Обработчик клика по сцене */
  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (tempLine.length === 0) {
      // первая точка линии
      setTempLine([pointer]);
    } else {
      // вторая точка – завершаем линию и режем
      const newLine: [Point, Point] = [tempLine[0], pointer];
      const newShapes = splitShapesWithLine(shapes, newLine);
      setShapes(newShapes);
      setTempLine([]);
    }
  };

  /** Отправка на бэкенд */
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

  return (
    <Card className="m-4 p-4 space-y-4 shadow-lg rounded-2xl">
      <CardContent className="space-y-4">
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border rounded-2xl shadow-inner"
          onClick={handleStageClick}
        >
          <Layer>
            {shapes.map((poly, idx) => (
              <Shape
                key={idx}
                sceneFunc={(context, shape) => {
                  if (poly.length === 0) return;
                  context.beginPath();
                  context.moveTo(poly[0].x, poly[0].y);
                  for (let i = 1; i < poly.length; i++) {
                    context.lineTo(poly[i].x, poly[i].y);
                  }
                  context.closePath();
                  context.fillStrokeShape(shape);
                }}
                fill="#e5e7eb" // tailwind gray-200
                stroke="#374151" // tailwind gray-700
                strokeWidth={1}
              />
            ))}
            {tempLine.length === 1 && (
              <Line
                points={[tempLine[0].x, tempLine[0].y, tempLine[0].x, tempLine[0].y]}
                stroke="#ef4444" // tailwind red-500
                strokeWidth={2}
                dash={[4, 4]}
              />
            )}
          </Layer>
        </Stage>

        <Button onClick={sendToBackend} className="w-full gap-2">
          <Send size={16} /> Отправить на бэкенд
        </Button>
      </CardContent>
    </Card>
  );
}

