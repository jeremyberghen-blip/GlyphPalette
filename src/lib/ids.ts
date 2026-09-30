// Unique-enough ids for canvases, definitions, nodes, and wires.

let idCounter = 0;
export const uid = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
