import assert from "node:assert/strict";

import { buildInventoryMovementPayload } from "../admin-operations.js";
import { calculateInventoryQuantity } from "../lib/operations-store.js";

const inboundPayload = buildInventoryMovementPayload({
  itemId: "inventory-test-item",
  movementType: "in",
  quantity: "3",
  note: "입고 테스트"
});

assert.equal(inboundPayload.type, "inventory-movement");
assert.equal(inboundPayload.movementType, "in");
assert.equal(inboundPayload.quantity, 3);

assert.deepEqual(calculateInventoryQuantity(10, inboundPayload.movementType, inboundPayload.quantity), {
  type: "in",
  quantity: 3,
  previousQuantity: 10,
  nextQuantity: 13
});

assert.deepEqual(calculateInventoryQuantity(10, "out", 4), {
  type: "out",
  quantity: 4,
  previousQuantity: 10,
  nextQuantity: 6
});

assert.equal(calculateInventoryQuantity(0.1, "in", 0.2).nextQuantity, 0.3);

assert.throws(() => calculateInventoryQuantity(2, "out", 3), /INVENTORY_QUANTITY_SHORT/);
assert.throws(() => calculateInventoryQuantity(2, "", 1), /INVENTORY_MOVEMENT_INVALID/);

console.log("Operations tests passed.");
