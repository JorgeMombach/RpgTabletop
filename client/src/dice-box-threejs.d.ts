// A biblioteca não traz tipos; o uso fica restrito a client/src/dice3d.ts.
declare module "@3d-dice/dice-box-threejs" {
  const DiceBox: new (selector: string, config?: Record<string, unknown>) => unknown;
  export default DiceBox;
}
