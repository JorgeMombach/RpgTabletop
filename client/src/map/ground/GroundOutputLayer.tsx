import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Image as KImage, Layer } from "react-konva";
import { onEffectsDrawn, onFogDrawn, onGroundDrawn, onPropsDrawn, onWallsDrawn, onWeatherDrawn, useDrawnBox, useGroundOutputs } from "./groundOutputs";

/**
 * Uma saída do chão numa camada do mapa (docs/design/luz.md): `light` multiplica tudo o que está embaixo (a luz da
 * cena, as sombras, as tochas); `flame` soma (chamas, faíscas, brilho); `torches` é o corpo das fontes de luz fixas
 * (docs/design/luzes.md), com mistura normal. A imagem fica presa à tela, como a do chão.
 */
export function GroundOutputLayer({ which, view, size }: { which: "light" | "flame" | "torches"; view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => state[which]);
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    // A mistura é a do canvas da camada inteira com as camadas de baixo.
    layer.getNativeCanvasElement().style.mixBlendMode = which === "light" ? "multiply" : which === "flame" ? "screen" : "normal";
    return onGroundDrawn(() => layer.batchDraw());
  }, [which, image]);

  if (!image) return null;
  return (
    <Layer ref={layerRef} listening={false}>
      <KImage image={image} {...box} />
    </Layer>
  );
}

/**
 * As paredes, portas e janelas da placa de vídeo (docs/design/relevo.md, etapa 2) dentro da camada das paredes, presas
 * à tela, com mistura normal. A camada só redesenha quando a imagem das paredes muda (não a cada quadro da água).
 */
export function GroundWallsImage({ view, size }: { view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => state.walls);
  const imageRef = useRef<Konva.Image>(null);

  useEffect(() => onWallsDrawn(() => imageRef.current?.getLayer()?.batchDraw()), [image]);

  if (!image) return null;
  return <KImage ref={imageRef} listening={false} image={image} {...box} />;
}

/**
 * Os objetos da placa de vídeo (docs/design/objetos.md) numa camada própria, presa à tela, com mistura normal: os de
 * baixo logo abaixo da camada dos objetos (que fica só com os nós de clique), os de cima logo abaixo das copas. Só
 * redesenha quando as imagens dos objetos mudam.
 */
export function GroundPropsImage({ which, view, size }: { which: "below" | "above"; view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => (which === "below" ? state.propsBelow : state.propsAbove));
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => onPropsDrawn(() => layerRef.current?.batchDraw()), [image]);

  if (!image) return null;
  return (
    <Layer ref={layerRef} listening={false}>
      <KImage image={image} {...box} />
    </Layer>
  );
}

/**
 * A névoa de guerra da placa de vídeo (docs/design/nevoa.md), no lugar da camada da névoa: primeiro o véu cinza, que
 * mistura por saturação (tira a cor do explorado), depois a fumaça, com mistura normal. Redesenha a cada quadro da
 * fumaça.
 */
export function GroundFogLayer({ view, size }: { view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const fog = useGroundOutputs((state) => state.fog);
  const tint = useGroundOutputs((state) => state.fogTint);
  const tintRef = useRef<Konva.Layer>(null);
  const fogRef = useRef<Konva.Layer>(null);

  useEffect(() => {
    const tintLayer = tintRef.current;
    if (tintLayer) tintLayer.getNativeCanvasElement().style.mixBlendMode = "saturation";
    return onFogDrawn(() => {
      tintRef.current?.batchDraw();
      fogRef.current?.batchDraw();
    });
  }, [fog, tint]);

  if (!fog || !tint) return null;
  return (
    <>
      <Layer ref={tintRef} listening={false}>
        <KImage image={tint} {...box} />
      </Layer>
      <Layer ref={fogRef} listening={false}>
        <KImage image={fog} {...box} />
      </Layer>
    </>
  );
}

/**
 * Os efeitos de área da placa de vídeo (docs/design/efeitos.md), dentro da camada dos efeitos (acima do chão e do
 * grid, abaixo dos tokens), presos à tela. Redesenha a cada quadro dos efeitos.
 */
export function GroundEffectsImage({ view, size }: { view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => state.effects);
  const imageRef = useRef<Konva.Image>(null);

  useEffect(() => onEffectsDrawn(() => imageRef.current?.getLayer()?.batchDraw()), [image]);

  if (!image) return null;
  return <KImage ref={imageRef} listening={false} image={image} {...box} />;
}

/**
 * A moldura da cena (docs/design/moldura.md): a mesa de fora, a moldura e a sombra dela sobre a cena, numa camada
 * acima de tudo o que é do mapa e abaixo da luz. Redesenha a cada desenho do chão.
 */
export function GroundFrameLayer({ view, size }: { view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => state.frame);
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => onGroundDrawn(() => layerRef.current?.batchDraw()), [image]);

  if (!image) return null;
  return (
    <Layer ref={layerRef} listening={false}>
      <KImage image={image} {...box} />
    </Layer>
  );
}

/**
 * Uma camada do clima da placa de vídeo (docs/design/clima.md): a cobertura do chão (logo acima do chão), o que anda
 * no ar (acima das copas, abaixo da luz) ou o que brilha sozinho com o clarão (acima da luz). Presa à tela.
 */
export function GroundWeatherLayer({ which, view, size }: { which: "ground" | "air" | "glow"; view: { x: number; y: number; scale: number }; size: { width: number; height: number } }) {
  const box = useDrawnBox(view, size);
  const image = useGroundOutputs((state) => (which === "ground" ? state.weatherGround : which === "air" ? state.weatherAir : state.weatherGlow));
  const layerRef = useRef<Konva.Layer>(null);

  useEffect(() => onWeatherDrawn(() => layerRef.current?.batchDraw()), [image]);

  if (!image) return null;
  return (
    <Layer ref={layerRef} listening={false}>
      <KImage image={image} {...box} />
    </Layer>
  );
}
