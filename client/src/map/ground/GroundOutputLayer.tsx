import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Image as KImage, Layer } from "react-konva";
import { onGroundDrawn, onWallsDrawn, useGroundOutputs } from "./groundOutputs";

/**
 * Uma saída do chão numa camada do mapa (docs/design/luz.md): `light` multiplica tudo o que está embaixo (a luz da
 * cena, as sombras, as tochas); `flame` soma (chamas, faíscas, brilho). A imagem fica presa à tela, como a do chão.
 */
export function GroundOutputLayer({ which, view, size }: { which: "light" | "flame"; view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const image = useGroundOutputs((state) => state[which]);
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    // A mistura é a do canvas da camada inteira com as camadas de baixo.
    layer.getNativeCanvasElement().style.mixBlendMode = which === "light" ? "multiply" : "screen";
    return onGroundDrawn(() => layer.batchDraw());
  }, [which, image]);

  if (!image) return null;
  return (
    <Layer ref={layerRef} listening={false}>
      <KImage image={image} x={-view.x / view.scale} y={-view.y / view.scale} width={size.width / view.scale} height={size.height / view.scale} />
    </Layer>
  );
}

/**
 * As paredes, portas e janelas da placa de vídeo (docs/design/relevo.md, etapa 2) dentro da camada das paredes, presas
 * à tela, com mistura normal. A camada só redesenha quando a imagem das paredes muda (não a cada quadro da água).
 */
export function GroundWallsImage({ view, size }: { view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const image = useGroundOutputs((state) => state.walls);
  const imageRef = useRef<Konva.Image>(null);

  useEffect(() => onWallsDrawn(() => imageRef.current?.getLayer()?.batchDraw()), [image]);

  if (!image) return null;
  return <KImage ref={imageRef} listening={false} image={image} x={-view.x / view.scale} y={-view.y / view.scale} width={size.width / view.scale} height={size.height / view.scale} />;
}
