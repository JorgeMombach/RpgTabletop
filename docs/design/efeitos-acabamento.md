# Acabamento de três efeitos do mapa (fogo, raízes, eletrificado)

Combinado em 2026-11-16, em brainstorm com o dono do projeto, na branch `feat/campanha`. Vem antes do projeto maior de criação de mapa (objetos redesenhados com arte mais desenhada e mapa vivo, com árvores balançando e água animada), que terá desenho próprio.

## Por quê

O dono olhou a galeria com os 25 objetos e os 18 efeitos no mapa. A maioria está boa, mas **fogo, raízes e eletrificado** têm animações estranhas: parecem "feitas em canvas". O pedido é de estética: mais desenhado, formas redondas e orgânicas.

## Diagnóstico (em `client/src/map/effectFx.ts`)

- **Fogo:** a textura de calor desliza sem parar para o topo da tela. Visto de cima, parece uma cachoeira de fogo subindo, não chamas. As chamas são bolhas redondas de brilho.
- **Raízes:** a textura inteira aumenta e diminui ("respira"); parece o chão dando zoom. As raízes são um ladrilho repetido.
- **Eletrificado:** o brilho de fundo pula para uma posição aleatória a cada quadro (tremedeira). Os raios são zigue-zagues retos, sem galhos, que somem de uma vez.

## O que muda

- **Fogo:** as chamas tremulam no lugar, em forma de língua (gota: redonda na base, pontuda na ponta), inclinadas de leve pelo vento, com vida curta e pouca subida. O calor de fundo deixa de deslizar: oscila devagar em volta do lugar. Por baixo, brasas com rachaduras que pulsam. Fagulhas e fumaça continuam.
- **Raízes:** raízes desenhadas para a área do efeito (não ladrilho): curvas que se ramificam, grossas na base e finas na ponta, com sombra e luz, na cor do efeito. Ficam paradas; só as pontas se mexem devagar, como se rastejassem. A terra revolvida por baixo continua. Raízes novas quando a área muda de tamanho.
- **Eletrificado:** o brilho de fundo anda devagar e tremula suave (sem pular); clarão de vez em quando que acende e apaga em uma fração de segundo, não num quadro só. Raios em arco curvo com galhos, que piscam enquanto vivem e deixam um rastro azul que some mais devagar.

## Abordagens

- **Ajustar os três desenhos no canvas (escolhida):** mesmo motor dos outros 15 efeitos, sem dependência nova; o estilo fica coerente com o resto.
- Trocar por sprites ou arte pronta: fica para o projeto maior, que decide a arte nova de tudo; trocar só três efeitos agora deixaria estilos misturados.

## Fora do escopo

- Os outros 15 efeitos, os objetos e a animação do mapa inteiro (projeto seguinte).
- A versão parada dos efeitos (textura do E19, usada com *Reduzir efeitos* e na lista de efeitos) não muda.

## Para não fazer

- Movimento contínuo numa direção da tela (o mapa é visto de cima).
- Qualquer coisa que pule a cada quadro.
- Mais peso que hoje: mesmos tetos de partículas por área.

## Fica com quem implementa

Formas, cores e velocidades exatas: decididas no navegador, efeito por efeito, com o dono olhando.
