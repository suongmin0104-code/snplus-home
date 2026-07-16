import assert from "node:assert/strict";

import { buildEstimateOperationPayload, calculateDocumentTotals } from "../admin-document.js";
import { buildInventoryMovementPayload } from "../admin-operations.js";
import { calculateInventoryQuantity, estimatePdfPath } from "../lib/operations-store.js";

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

const estimateDocument = {
  estimateId: "estimate-document-test-001",
  date: "2026-07-16",
  client: "테스트 거래처",
  project: "디자인난간 제작·설치",
  documentNumber: "SN-20260716-001",
  vatMode: "separate",
  managerName: "박정민",
  managerPhone: "010-9089-7877",
  items: [
    { item: "디자인난간", quantity: "2", unitPrice: "100,000" },
    { item: "", quantity: "", unitPrice: "" }
  ]
};

assert.deepEqual(calculateDocumentTotals(estimateDocument.items, "separate"), {
  supply: 200000,
  vat: 20000,
  total: 220000
});
assert.deepEqual(calculateDocumentTotals([{ quantity: "1", unitPrice: "110,000" }], "included"), {
  supply: 100000,
  vat: 10000,
  total: 110000
});

const estimatePayload = buildEstimateOperationPayload(estimateDocument);
assert.equal(estimatePayload.type, "estimate");
assert.equal(estimatePayload.id, estimateDocument.estimateId);
assert.equal(estimatePayload.title, estimateDocument.project);
assert.equal(estimatePayload.documentNumber, estimateDocument.documentNumber);
assert.equal(estimatePayload.totalAmount, 220000);
assert.equal(estimatePayload.itemCount, 1);
assert.equal(estimatePayload.document.estimateId, estimateDocument.estimateId);
assert.equal(buildEstimateOperationPayload(estimatePayload.document).id, estimateDocument.estimateId);
assert.equal(
  estimatePdfPath(estimateDocument.estimateId),
  `admin-operations/snplus/estimate-pdfs/${estimateDocument.estimateId}.pdf`
);
assert.equal(estimatePdfPath("잘못된 견적 ID"), "");

console.log("Operations tests passed.");
