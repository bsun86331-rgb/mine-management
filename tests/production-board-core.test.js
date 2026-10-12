const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/production-board-core');
function fixture() {
    const state = C.emptyState(), board = C.emptyBoard('2026-10-11', '白班');
    const people = [ ['D', '调度员', 'A'], ['E1D', '挖机司机', 'A'], ['T1D', '汽车司机', 'A'], ['T2D', '汽车司机', 'A'], ['BD', '汽车司机', 'B'], ['AD', '铲车司机', 'A'] ].map(([personId, position, team]) => ({ personId, name: personId, position, team: `生产${team}组`, status: 'approved', personnelStatus: '在职可用' }));
    const equipment = [['E1', '挖机'], ['T1', '矿卡'], ['T2', '矿卡'], ['T3', '矿卡'], ['A1', '装载机']].map(([equipmentId, equipmentType]) => ({ equipmentId, equipmentNumber: equipmentId, equipmentType, status: 'available' }));
    const data = { people, equipment, tasks: [], executions: [], zones: [{ zoneId: 'L', zoneType: 'loading', zoneName: '煤装载区' }, { zoneId: 'U', zoneType: 'unloading', zoneName: '煤卸载区' }], operational: [], maintenance: [], leaves: [], attendance: [], trips: [] };
    board.groups.push({ id: 'G1', team: 'A', excavatorId: 'E1', excavatorDriverId: 'E1D', trucks: [{ equipmentId: 'T1', driverId: 'T1D' }], loadingZoneId: 'L', unloadingZoneIds: ['U'], material: '煤' });
    return { state, board, data };
}
test('unassigned roster contains only frontline personnel in the selected shift', () => {
    const { state, board, data } = fixture();
    data.people.push({ personId: 'ADMIN', position: '管理员', team: '生产A组', status: 'approved' });
    data.people.push({ personId: 'UNKNOWN', position: '汽车司机', status: 'approved' });
    data.people.push({ personId: 'PENDING', position: '水车司机', team: '生产A组', status: 'pending' });
    assert.deepEqual(C.unassignedPeople(board, state, data).map(C.personId), ['T2D', 'AD']);
    data.attendance = [
        { personId: 'T2D', date: board.date, shiftType: '夜班', whiteUnits: 0, nightUnits: 1 },
        { personId: 'AD', date: board.date, shift: '白班' },
        { personId: 'BD', date: board.date, shift: '白班' },
        { personId: 'UNKNOWN', checkInAt: '2026-10-12T01:00:00' }
    ];
    assert.deepEqual(C.unassignedPeople(board, state, data).map(C.personId), ['BD', 'AD']);
    const night = C.emptyBoard(board.date, '夜班');
    assert.deepEqual(C.unassignedPeople(night, state, data).map(C.personId), ['T2D', 'UNKNOWN']);
    data.people.find(p => p.personId === 'AD').workShift = '夜班';
    // Date-specific attendance takes precedence over a static profile shift.
    assert.equal(C.personInShift(data.people.find(p => p.personId === 'AD'), board, state, data), true);
    const empty = C.emptyBoard('2026-10-13', '白班');
    assert.equal(C.unassignedPeople(empty, state, data).length, 0);
});
test('night after midnight belongs to previous production day; exact boundaries switch', () => {
    assert.deepEqual(C.currentSlot(new Date('2026-10-12T07:59:59')), { date: '2026-10-11', shift: '夜班' });
    assert.deepEqual(C.currentSlot(new Date('2026-10-12T08:00:00')), { date: '2026-10-12', shift: '白班' });
    assert.deepEqual(C.currentSlot(new Date('2026-10-12T20:00:00')), { date: '2026-10-12', shift: '夜班' });
    const custom = { dayStart: '06:30', dayEnd: '18:30', nightStart: '18:30', nightEnd: '06:30' };
    assert.equal(C.currentSlot(new Date('2026-10-12T06:29:00'), custom).date, '2026-10-11');
    assert.throws(() => C.validateSchedule({ ...custom, nightStart: '19:00' }), /无重叠/);
});
test('only approved dispatch personnel can edit', () => {
    const { data } = fixture();
    assert.equal(C.canEdit({ personId: 'D' }, data.people), true);
    assert.equal(C.canEdit({ personId: 'T1D' }, data.people), false);
    assert.equal(C.canEdit({ personId: 'missing' }, data.people), false);
    data.people[0].status = 'pending';
    assert.equal(C.canEdit({ personId: 'D' }, data.people), false);
});
test('selecting a crew replaces the other crew in a draft without changing the published board', () => {
    const { board } = fixture();
    board.groups.push({ ...C.clone(board.groups[0]), id: 'GB', team: 'B' });
    board.auxiliary = [{ team: 'A', equipmentId: 'AA' }, { team: 'B', equipmentId: 'AB' }];
    const before = C.clone(board), draft = C.teamDraft(board, 'B');
    assert.equal(draft.team, 'B');
    assert.deepEqual(draft.groups.map(g => g.id), ['GB']);
    assert.deepEqual(draft.auxiliary.map(a => a.equipmentId), ['AB']);
    assert.deepEqual(board, before);
    assert.throws(() => C.teamDraft(board, ''), /请选择/);
});
test('tasks do not require or prescribe material before the actual unloading zone is known', () => {
    const { state, board, data } = fixture();
    delete board.groups[0].material;
    assert(C.validateBoard(board, state, data));
    board.published = true;
    board.publishedAt = '2026-10-11T08:00:00';
    state.boards[C.slotKey(board.date, board.shift)] = board;
    const projected = C.projections(state, data, new Date('2026-10-11T09:00:00'));
    assert.equal(projected.tasks[0].materialType, '');
    assert.equal(projected.tasks[0].material, '');
});
test('dispatch page restores its approved role identity after another role changes the global identity', () => {
    const { data } = fixture();
    assert.equal(C.dispatchIdentity('T1D', 'D', '', data.people).personId, 'D');
    assert.equal(C.dispatchIdentity('T1D', '', 'D', data.people).personId, 'D');
    assert.equal(C.dispatchIdentity('T1D', '', '', data.people).personId, 'T1D');
    data.people[0].approvalStatus = 'pending';
    assert(C.canEdit({ personId: 'D' }, data.people));
    data.people[0].approvalStatus = 'rejected';
    assert(!C.canEdit({ personId: 'D' }, data.people));
    assert.equal(C.dispatchIdentity('T1D', 'D', '', data.people).personId, 'T1D');
});
test('choices exclude occupied, maintenance, wrong-team and leave resources', () => {
    const { state, board, data } = fixture();
    data.maintenance.push({ equipmentId: 'T3', status: 'pending_dispatch' });
    assert.deepEqual(C.equipmentChoices('truck', board, state, data).map(C.equipmentId), ['T2']);
    assert.deepEqual(C.personChoices('truck', 'A', board, state, data).map(C.personId), ['T2D']);
    data.leaves.push({ personId: 'T2D', status: 'approved', startDate: '2026-10-11', endDate: '2026-10-11' });
    assert.equal(C.personChoices('truck', 'A', board, state, data).length, 0);
    assert.equal(C.equipmentChoices('truck', board, state, data, 'T1').some(e => C.equipmentId(e) === 'T1'), true);
});
test('publish rejects duplicate assignments and stale resource availability', () => {
    const { state, board, data } = fixture();
    assert.equal(C.validateBoard(board, state, data), true);
    const duplicate = C.clone(board); duplicate.groups[0].trucks.push({ equipmentId: 'T1', driverId: 'T2D' });
    assert.throws(() => C.validateBoard(duplicate, state, data), /设备不能重复/);
    const driverDuplicate = C.clone(board); driverDuplicate.groups[0].trucks.push({ equipmentId: 'T2', driverId: 'T1D' });
    assert.throws(() => C.validateBoard(driverDuplicate, state, data), /人员不能重复/);
    data.operational.push({ equipmentId: 'T1', status: '维修中' });
    assert.throws(() => C.validateBoard(board, state, data), /不可调配/);
});
test('daily trips deduplicate aliases and keep A/B teams separate from shifts', () => {
    const { state, board, data } = fixture();
    const trip = (tripId, completedAt, team, material) => ({ tripId, completedAt, status: 'completed', team, material });
    data.trips = [trip('1', '2026-10-11T09:00:00', 'A', '煤'), trip('1', '2026-10-11T09:00:00', 'A', '煤'), trip('2', '2026-10-11T22:00:00', 'A', '岩石'), trip('3', '2026-10-12T02:00:00', 'B', '煤'), trip('4', '2026-10-12T08:00:00', 'B', '煤'), { ...trip('5', '2026-10-11T12:00:00', 'A', '煤'), status: 'pending_dispatch' }];
    const stats = C.statistics('2026-10-11', '白班', state, data, board);
    assert.deepEqual([stats.totalTrips, stats.aTrips, stats.bTrips, stats.coalTrips, stats.aCoal, stats.bCoal, stats.shiftTrips], [3, 2, 1, 2, 1, 1, 1]);
    assert.deepEqual([stats.aSlag, stats.bSlag], [1, 0]);
    assert.equal(C.statistics('2026-10-11', '夜班', state, data, board).shiftTrips, 2);
});
test('attendance and assignment remain independent; idle and maintenance counts are truthful', () => {
    const { state, board, data } = fixture();
    data.attendance.push({ personId: 'T1D', date: board.date, shift: board.shift, status: 'confirmed' });
    data.maintenance.push({ equipmentId: 'T3', status: 'repairing' });
    const stats = C.statistics(board.date, board.shift, state, data, board);
    assert.equal(stats.personnelDuty, 1);
    assert.equal(stats.productionPeople, 2);
    assert.equal(stats.truckTotal, 3);
    assert.equal(stats.truckDuty, 1);
    assert.equal(stats.truckIdle, 1);
    assert.equal(stats.truckRepair, 1);
});
test('existing checkInAt and dispatch-confirmed units count in the correct shift', () => {
    const { state, board, data } = fixture();
    data.attendance = [{ personId: 'T1D', date: '2026-10-12', checkInAt: '2026-10-12T02:00:00', attendanceStatus: 'present' }, { personId: 'T2D', date: '2026-10-11', batchConfirmed: true, confirmedAttendance: 1, whiteUnits: 1, nightUnits: 0 }];
    assert.equal(C.statistics(board.date, '白班', state, data, board).personnelDuty, 1);
    assert.equal(C.statistics(board.date, '夜班', state, data, board).personnelDuty, 1);
});
test('legacy task import and projections preserve IDs and consumer contracts', () => {
    const { state, board, data } = fixture();
    board.published = true; board.version = 1; board.publishedAt = '2026-10-11T08:00:00';
    state.boards[C.slotKey(board.date, board.shift)] = board;
    let projection = C.projections(state, data, new Date('2026-10-11T10:00:00'));
    const task = projection.tasks[0];
    assert.equal(task.status, 'active'); assert.equal(task.driverAssignments[0].vehicleNumber, 'T1');
    assert.equal(task.bindings[0].excavatorDriverId, 'E1D');
    assert.equal(task.allowedUnloadingZones[0].zoneName, '煤卸载区');
    assert.equal(projection.executions[0].shiftId, task.currentShiftId);
    assert.equal(C.projections(state, data, new Date('2026-10-11T21:00:00')).tasks[0].status, 'handed_over');
    assert.equal(C.projections(state, data, new Date('2026-10-11T07:00:00')).tasks[0].status, 'scheduled');
    const imported = C.boardFor(C.emptyState(), board.date, board.shift, { ...data, tasks: [{ ...task, boardManaged: false }] });
    assert.equal(imported.groups[0].trucks[0].driverId, 'T1D');
    assert.equal(imported.groups[0].excavatorDriverId, 'E1D');
});
