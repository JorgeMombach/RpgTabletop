import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { floorRoomAt, magnetWallEnds, magnetWallPoint, wallRooms, type GridPos, type Wall } from "@rpg/shared";

// Ímã das paredes livres: a ponta gruda na ponta ou no corpo de uma parede perto (até 0,2 casa), para emendar e
// fechar o cômodo; longe de tudo, fica onde foi solta (em centésimos de casa, como o servidor guarda).
const wall = (id: string, from: [number, number], to: [number, number]): Wall => ({
  id,
  from: { col: from[0], row: from[1] },
  to: { col: to[0], row: to[1] },
});
const at = (col: number, row: number): GridPos => ({ col, row });

describe("ímã das paredes livres", () => {
  const base = [wall("a", [0, 0], [4, 0])];

  it("ponta perto da ponta de outra parede gruda nela", () => {
    assert.deepEqual(magnetWallPoint(at(4.12, 0.1), base), at(4, 0));
  });

  it("longe do ímã fica onde foi solta, em centésimos", () => {
    assert.deepEqual(magnetWallPoint(at(4.5, 1.2345), base), at(4.5, 1.23));
  });

  it("perto do meio de uma parede gruda na linha dela", () => {
    assert.deepEqual(magnetWallPoint(at(2.03, 0.15), base), at(2.03, 0));
  });

  it("a ponta vale mais que o corpo de outra parede mais perto", () => {
    const walls = [...base, wall("b", [4.1, -2], [4.1, 2])];
    assert.deepEqual(magnetWallPoint(at(4.05, 0.05), walls), at(4, 0));
  });

  it("quatro paredes livres traçadas com folga fecham o cômodo", () => {
    const walls: Wall[] = [];
    const draw = (from: GridPos, to: GridPos) => {
      const ends = magnetWallEnds(from, to, walls);
      walls.push({ id: `w${walls.length}`, from: ends.from, to: ends.to });
    };
    draw(at(1.03, 1.02), at(5.97, 1.04));
    draw(at(6.05, 1.1), at(6.02, 4.96));
    draw(at(5.91, 5.06), at(1.04, 4.98));
    draw(at(0.95, 4.9), at(1.08, 1.11));
    const room = floorRoomAt(walls, { x: 3, y: 3 }, "stone");
    assert.ok(room, "o cômodo fecha");
    assert.equal(wallRooms(walls, "stone", { allStyles: true }).length, 1);
  });

  it("parede que encosta no meio de uma diagonal fecha o cômodo (o arredondamento não deixa vão)", () => {
    const walls: Wall[] = [wall("base", [0, 0], [6, 0]), wall("diagonal", [0, 0], [6, 4.13])];
    // Do meio da diagonal até a base: as duas pontas pelo ímã. Na diagonal, o ponto mais perto (3,5067; 2,4138) vira
    // (3,51; 2,41) em centésimos, um fio antes da linha (que ali passa em 2,416): sem passar dela, não emendaria.
    const ends = magnetWallEnds(at(3.53, 2.38), at(3.52, 0.06), walls);
    walls.push({ id: "t", from: ends.from, to: ends.to });
    const room = floorRoomAt(walls, { x: 2, y: 0.4 }, "stone");
    assert.ok(room, "o triângulo entre a base, a diagonal e a parede nova fecha");
  });

  it("porta traçada ao longo de uma parede fica sobre ela, sem passar da ponta", () => {
    const ends = magnetWallEnds(at(1.02, 0.08), at(2.01, -0.07), base);
    assert.deepEqual(ends, { from: at(1.02, 0), to: at(2.01, 0) });
  });
});
