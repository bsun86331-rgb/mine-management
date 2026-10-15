"use strict";

const { test, expect } = require("@playwright/test");
const ProductionBoardCore = require("../js/production-board-core.js");

test("TEST无稳定趟次编号记录保持待人工核对且不计入正式趟次", () => {
  const legacyRows = [
    { taskId: "TEST-TASK-001", driverId: "TEST-DRIVER-001", vehicleNumber: "TEST-TRUCK-01", status: "completed", completedAt: "2026-10-15T02:00:00Z" },
    { taskId: "TEST-TASK-001", driverId: "TEST-DRIVER-001", vehicleNumber: "TEST-TRUCK-01", status: "completed", completedAt: "2026-10-15T02:00:00Z" }
  ];
  expect(ProductionBoardCore.validTrips(legacyRows)).toEqual([]);
  expect(ProductionBoardCore.hasStableTripId(legacyRows[0])).toBe(false);

  const stableRows = [
    { tripId: "TEST-TRIP-001", taskId: "TEST-TASK-001", status: "completed", completedAt: "2026-10-15T02:00:00Z" },
    { tripId: "TEST-TRIP-001", taskId: "TEST-TASK-001", status: "completed", completedAt: "2026-10-15T02:00:00Z" },
    { tripId: "TEST-TRIP-002", taskId: "TEST-TASK-002", status: "completed", completedAt: "2026-10-15T03:00:00Z" }
  ];
  expect(ProductionBoardCore.validTrips(stableRows).map(row => row.tripId)).toEqual([
    "TEST-TRIP-001",
    "TEST-TRIP-002"
  ]);

  const stableAliases = [
    { recordId: "TEST-RECORD-001", status: "completed", completedAt: "2026-10-15T04:00:00Z" },
    { record_id: "TEST-RECORD-001", status: "completed", completedAt: "2026-10-15T04:00:00Z" },
    { clientRecordId: "TEST-CLIENT-001", status: "completed", completedAt: "2026-10-15T05:00:00Z" },
    { client_record_id: "TEST-CLIENT-002", status: "completed", completedAt: "2026-10-15T06:00:00Z" },
    { id: "TEST-ID-001", status: "completed", completedAt: "2026-10-15T07:00:00Z" }
  ];
  expect(ProductionBoardCore.validTrips(stableAliases).map(row => ProductionBoardCore.stableTripId(row))).toEqual([
    "TEST-RECORD-001",
    "TEST-CLIENT-001",
    "TEST-CLIENT-002",
    "TEST-ID-001"
  ]);
});
