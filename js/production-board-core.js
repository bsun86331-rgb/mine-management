/* Shared production board domain model. No DOM or persistence side effects. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ProductionBoardCore = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';
    const DEFAULT_SCHEDULE = { dayStart: '08:00', dayEnd: '20:00', nightStart: '20:00', nightEnd: '08:00' };
    const clone = value => JSON.parse(JSON.stringify(value));
    const array = value => Array.isArray(value) ? value : [];
    const text = value => String(value == null ? '' : value);
    function stableTripId(row) {
        return [row?.tripId, row?.trip_id, row?.recordId, row?.record_id, row?.clientRecordId, row?.client_record_id, row?.id]
            .map(value => text(value).trim())
            .find(Boolean) || '';
    }
    const hasStableTripId = row => Boolean(stableTripId(row));
    const flatten = row => ({ ...row?.extra, ...row });
    const personId = row => text(row?.personId || row?.person_id || row?.employeeId || row?.driverId || row?.id);
    const equipmentId = row => text(row?.equipmentId || row?.equipment_id || row?.equipmentNumber || row?.vehicleId || row?.vehicle_id || row?.vehicleNumber || row?.id);
    const equipmentNumber = row => text(row?.equipmentNumber || row?.vehicleNumber || row?.vehicle_number || equipmentId(row));
    const team = row => /(?:生产)?A(?:组|班)?/i.test(text(row?.team || row?.productionTeam || row?.production_team || row?.group)) ? 'A' : /(?:生产)?B(?:组|班)?/i.test(text(row?.team || row?.productionTeam || row?.production_team || row?.group)) ? 'B' : '';
    function role(row) {
        const value = text(row?.position || row?.role);
        if (/挖机|挖掘机/.test(value)) return 'excavator';
        if (/汽车司机|卡车|矿卡|运输司机/.test(value)) return 'truck';
        if (/排土管理/.test(value)) return 'dump_management';
        if (/辅助|铲车|装载机|水车|洒水|加油|平路|推土|大巴/.test(value)) return 'auxiliary';
        if (/车队长|调度/.test(value)) return 'dispatch';
        return 'other';
    }
    function category(row) {
        const value = text(row?.equipmentType || row?.vehicleType || row?.type || row?.category || row?.vehicle_type);
        if (/excavator|挖机|挖掘/i.test(value)) return 'excavator';
        if (/truck|矿卡|卡车|汽车|运输车/i.test(value)) return 'truck';
        if (/loader|装载|铲车/i.test(value)) return 'loader';
        if (/water|洒水|水车/i.test(value)) return 'water';
        if (/fuel|加油/i.test(value)) return 'fuel';
        if (/grader|平路/i.test(value)) return 'grader';
        if (/dozer|推土/i.test(value)) return 'dozer';
        if (/bus|大巴/i.test(value)) return 'bus';
        return 'other';
    }
    function approved(row) {
        if (row?.enabled === false || /rejected|disabled|resigned|deleted|pending|待审核|离职|停用|驳回/.test(text(row?.status))) return false;
        const approval = row?.approvalStatus || row?.approval_status;
        return approval ? /approved|通过|已审核/.test(text(approval)) : /approved|active|working|available|leave|在职|作业|可用/.test(text(row?.status || row?.personnelStatus));
    }
    function minute(value) {
        if (!/^\d{2}:\d{2}$/.test(value || '')) return NaN;
        const [h, m] = value.split(':').map(Number);
        return h < 24 && m < 60 ? h * 60 + m : NaN;
    }
    function validateSchedule(schedule) {
        if (Object.values(schedule).some(v => !Number.isFinite(minute(v)))) throw new Error('请填写有效的班次时间。');
        if (schedule.dayStart === schedule.dayEnd) throw new Error('一个班次的开始和结束时间不能相同。');
        if (schedule.dayEnd !== schedule.nightStart || schedule.nightEnd !== schedule.dayStart) throw new Error('白班结束须等于夜班开始，夜班结束须等于白班开始，保证全天无重叠、无空档。');
        return schedule;
    }
    function dateKey(date) {
        return `${date.getFullYear()}-${text(date.getMonth() + 1).padStart(2, '0')}-${text(date.getDate()).padStart(2, '0')}`;
    }
    function shiftDate(date, delta) { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + delta); return dateKey(d); }
    function atMinute(date, minutes) { const d = new Date(date + 'T00:00:00'); d.setMinutes(minutes); return d; }
    function interval(date, shift, schedule = DEFAULT_SCHEDULE) {
        validateSchedule(schedule);
        const dayStart = minute(schedule.dayStart);
        const dayLength = (minute(schedule.dayEnd) - dayStart + 1440) % 1440;
        const start = atMinute(date, dayStart + (shift === '夜班' ? dayLength : 0));
        const end = atMinute(date, dayStart + (shift === '夜班' ? 1440 : dayLength));
        return { start, end };
    }
    function currentSlot(now = new Date(), schedule = DEFAULT_SCHEDULE) {
        const minutes = now.getHours() * 60 + now.getMinutes();
        const date = shiftDate(dateKey(now), minutes < minute(schedule.dayStart) ? -1 : 0);
        const day = interval(date, '白班', schedule);
        return { date, shift: now >= day.start && now < day.end ? '白班' : '夜班' };
    }
    const slotKey = (date, shift) => `${date}|${shift}`;
    function emptyBoard(date, shift) {
        return { id: `BOARD-${date}-${shift === '白班' ? 'D' : 'N'}`, date, shift, groups: [], auxiliary: [], published: false, version: 0 };
    }
    function emptyState() { return { schemaVersion: 2, revision: 0, schedule: clone(DEFAULT_SCHEDULE), boards: {}, audit: [] }; }
    function assignments(board) {
        const equipment = [], people = [];
        array(board?.groups).forEach(group => {
            if (group.excavatorId) equipment.push(group.excavatorId);
            if (group.excavatorDriverId) people.push(group.excavatorDriverId);
            array(group.dumpManagementPeople).forEach(id => { if (id) people.push(id); });
            array(group.trucks).forEach(truck => { if (truck.equipmentId) equipment.push(truck.equipmentId); if (truck.driverId) people.push(truck.driverId); });
        });
        array(board?.auxiliary).forEach(item => { if (item.equipmentId) equipment.push(item.equipmentId); if (item.driverId) people.push(item.driverId); });
        return { equipment, people };
    }
    function blockedEquipment(row, data) {
        const id = equipmentId(row), number = equipmentNumber(row);
        const matches = r => [r.equipmentId, r.equipment_id, r.equipmentNumber, r.vehicleId, r.vehicleNumber].some(v => v && [id, number].includes(text(v)));
        const states = [row, ...array(data.operational).filter(matches)];
        if (states.some(r => /repair|maintenance|disabled|停用|维修中|保养中|故障|待维修/i.test([r.status, r.currentStatus, r.equipmentStatus, r.operationalStatus, r.operational_status].join(' ')))) return true;
        return array(data.maintenance).some(r => matches(r) && /^(pending_dispatch|pending|approved|waiting|repairing|in_progress|working|待调度|待维修|维修中)$/.test(text(r.status)));
    }
    function onLeave(person, board, data, schedule) {
        if (/leave|请假|休假|离职|停用/i.test(text(person.personnelStatus || person.personnel_status || person.status))) return true;
        const range = interval(board.date, board.shift, schedule);
        return array(data.leaves).some(leave => {
            if (text(leave.personId || leave.person_id || leave.driverId || leave.employeeId) !== personId(person) || !/approved|已批准|通过/.test(text(leave.status))) return false;
            const start = new Date(leave.startTime || leave.startAt || leave.startDate || leave.start_date);
            let end = new Date(leave.endTime || leave.endAt || leave.endDate || leave.end_date);
            if (/^\d{4}-\d{2}-\d{2}$/.test(leave.endDate || leave.end_date || '')) end = new Date(end.getTime() + 86400000);
            return Number.isFinite(+start) && Number.isFinite(+end) && start < range.end && end > range.start;
        });
    }
    function occupiedElsewhere(board, state, data, schedule) {
        const used = { equipment: new Set(), people: new Set() }, range = interval(board.date, board.shift, schedule);
        Object.values(state.boards || {}).forEach(other => {
            if (!other.published || other.id === board.id) return;
            const otherRange = interval(other.date, other.shift, schedule);
            if (otherRange.start < range.end && otherRange.end > range.start) {
                const a = assignments(other); a.equipment.forEach(id => used.equipment.add(id)); a.people.forEach(id => used.people.add(id));
            }
        });
        array(data.tasks).filter(t => !t.boardManaged && /^(active|pending)$/.test(t.status)).forEach(task => {
            const date = task.shiftDate || task.date || text(task.publishedAt).slice(0, 10);
            if (date !== board.date || (task.shift && task.shift !== board.shift)) return;
            // Imported groups own these task IDs and can be adjusted in this board.
            if (array(board.groups).some(g => g.legacyTaskId === text(task.taskId || task.id))) return;
            const imported = importTask(task, data); const a = assignments(imported);
            a.equipment.forEach(id => used.equipment.add(id)); a.people.forEach(id => used.people.add(id));
        });
        return used;
    }
    function equipmentChoices(kind, board, state, data, currentId = '') {
        const own = new Set(assignments(board).equipment), external = occupiedElsewhere(board, state, data, state.schedule).equipment;
        return data.equipment.filter(row => {
            const id = equipmentId(row), cat = category(row);
            return (kind === 'auxiliary' ? !['truck', 'excavator', 'other'].includes(cat) : cat === kind) && !blockedEquipment(row, data) && !/disabled|deleted|停用/.test(text(row.status)) && !external.has(id) && (!own.has(id) || id === currentId);
        });
    }
    function personChoices(kind, groupTeam, board, state, data, currentId = '') {
        const own = new Set(assignments(board).people), external = occupiedElsewhere(board, state, data, state.schedule).people;
        return data.people.filter(row => {
            const id = personId(row);
            return approved(row) && role(row) === kind && (!groupTeam || team(row) === groupTeam) && personInShift(row, board, state, data) && !onLeave(row, board, data, state.schedule) && !external.has(id) && (!own.has(id) || id === currentId) && (id === currentId || !/working|作业中/.test(text(row.personnelStatus || row.personnel_status)));
        });
    }
    function validateBoard(board, state, data) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(board.date) || !['白班', '夜班'].includes(board.shift)) throw new Error('生产日期或班次无效。');
        if (!board.groups.length && !board.auxiliary.length) throw new Error('请至少添加一个生产组或一台辅助车辆。');
        const used = assignments(board);
        if (new Set(used.equipment).size !== used.equipment.length) throw new Error('同一班次内设备不能重复绑定。');
        if (new Set(used.people).size !== used.people.length) throw new Error('同一班次内人员不能重复绑定。');
        const validatePair = (kind, id, driverId, groupTeam, label) => {
            if (!id || !driverId) throw new Error(`${label}必须选择设备和司机。`);
            if (!equipmentChoices(kind, board, state, data, id).some(r => equipmentId(r) === id)) throw new Error(`${label}设备已不可调配，请重新选择。`);
            if (!personChoices(kind === 'excavator' ? 'excavator' : kind === 'truck' ? 'truck' : 'auxiliary', groupTeam, board, state, data, driverId).some(r => personId(r) === driverId)) throw new Error(`${label}司机不再空闲或班组不符，请重新选择。`);
        };
        board.groups.forEach((g, index) => {
            const label = `${index + 1}组`;
            if (!['A', 'B'].includes(g.team)) throw new Error(`${label}请选择A班组或B班组。`);
            validatePair('excavator', g.excavatorId, g.excavatorDriverId, g.team, label + '挖机');
            if (!g.trucks.length) throw new Error(`${label}请至少配置一台汽车。`);
            g.trucks.forEach(t => validatePair('truck', t.equipmentId, t.driverId, g.team, label + '汽车'));
            array(g.dumpManagementPeople).forEach(id => {
                if (!personChoices('dump_management', g.team, board, state, data, id).some(p => personId(p) === id)) throw new Error(`${label}排土管理人员不可调配、已请假或班组不符，请重新选择。`);
            });
            const load = data.zones.find(z => text(z.zoneId || z.zone_id || z.id) === g.loadingZoneId);
            if (!load || !/^(loading|load|装载区|装料区)$/.test(text(load.zoneType || load.zone_type || load.type))) throw new Error(`${label}请选择有效装载区。`);
            if (!g.unloadingZoneIds.length || g.unloadingZoneIds.some(id => !data.zones.some(z => text(z.zoneId || z.zone_id || z.id) === id && /^(unloading|unload|卸载区|卸料区)$/.test(text(z.zoneType || z.zone_type || z.type))))) throw new Error(`${label}请至少选择一个有效卸载区。`);
        });
        board.auxiliary.forEach((item, i) => validatePair('auxiliary', item.equipmentId, item.driverId, item.team, `辅助车辆${i + 1}`));
        return true;
    }
    function canonicalEquipment(id, data) {
        return equipmentId(data.equipment.find(e => [equipmentId(e), equipmentNumber(e)].includes(text(id))) || { id });
    }
    function importTask(task, data) {
        const result = { groups: [], auxiliary: [] };
        array(task.bindings).forEach((b, index) => {
            const excavator = canonicalEquipment(b.excavatorId || b.excavatorNumber, data);
            const exDriver = array(task.excavatorDriverAssignments).find(a => [a.excavatorId, a.excavatorNumber].includes(b.excavatorId || b.excavatorNumber));
            result.groups.push({ id: `import-${task.taskId || task.id}-${index}`, legacyTaskId: text(task.taskId || task.id), team: team(task) || team(exDriver) || 'A', excavatorId: excavator, excavatorDriverId: text(b.excavatorDriverId || b.operatorId || exDriver?.driverId || exDriver?.personId), trucks: array(b.truckIds || b.vehicleIds || b.trucks).map(id => {
                const rawId = typeof id === 'object' ? id.vehicleId || id.vehicleNumber || id.truckId : id;
                const a = array(task.driverAssignments).find(a => [a.vehicleId, a.vehicleNumber, a.truckId].includes(rawId));
                return { equipmentId: canonicalEquipment(rawId, data), driverId: text(a?.driverId || a?.personId) };
            }), loadingZoneId: text(b.loadingZoneId || task.loadingZoneId || task.load_zone_id), unloadingZoneIds: array(b.allowedUnloadingZoneIds || task.allowedUnloadingZoneIds || (task.unloadingZoneId ? [task.unloadingZoneId] : [])), material: /煤|coal/i.test(text(task.materialType || task.material)) ? '煤' : '岩石' });
        });
        result.auxiliary = array(task.auxiliaryAssignments).map(a => ({ equipmentId: canonicalEquipment(a.vehicleId || a.vehicleNumber, data), driverId: text(a.driverId || a.personId), team: team(a) || team(task), work: a.work || a.workContent || '' }));
        return result;
    }
    function boardFor(state, date, shift, data) {
        const saved = state.boards[slotKey(date, shift)];
        if (saved) return clone(saved);
        const board = emptyBoard(date, shift);
        array(data.tasks).filter(t => !t.boardManaged && /^(active|pending)$/.test(t.status) && (t.shiftDate || t.date || text(t.publishedAt).slice(0, 10)) === date && (!t.shift || t.shift === shift)).forEach(task => {
            const imported = importTask(task, data); board.groups.push(...imported.groups); board.auxiliary.push(...imported.auxiliary);
        });
        if (board.groups.length || board.auxiliary.length) { board.published = true; board.imported = true; }
        return board;
    }
    function projections(state, data, now = new Date()) {
        const tasks = [], executions = [], slot = currentSlot(now, state.schedule);
        const findPerson = id => data.people.find(p => personId(p) === id);
        const number = id => equipmentNumber(data.equipment.find(e => equipmentId(e) === id) || { id });
        const name = id => findPerson(id)?.name || '';
        Object.values(state.boards).filter(b => b.published).forEach(board => {
            const window = interval(board.date, board.shift, state.schedule);
            const status = board.date === slot.date && board.shift === slot.shift ? 'active' : now < window.start ? 'scheduled' : 'handed_over';
            board.groups.forEach(group => {
                const taskId = `${board.id}-${group.id}`, shiftId = `${taskId}-SHIFT`;
                const load = data.zones.find(z => text(z.zoneId || z.zone_id || z.id) === group.loadingZoneId);
                const unload = data.zones.filter(z => group.unloadingZoneIds.includes(text(z.zoneId || z.zone_id || z.id)));
                const binding = { excavatorId: number(group.excavatorId), excavatorNumber: number(group.excavatorId), excavatorDriverId: group.excavatorDriverId, excavatorDriverName: name(group.excavatorDriverId), truckIds: group.trucks.map(t => number(t.equipmentId)), loadingZoneId: group.loadingZoneId, loadingPoint: load?.zoneName || load?.zone_name || load?.name || '', allowedUnloadingZoneIds: clone(group.unloadingZoneIds) };
                const driverAssignments = group.trucks.map(t => ({ driverId: t.driverId, personId: t.driverId, driverName: name(t.driverId), personName: name(t.driverId), vehicleId: number(t.equipmentId), vehicleNumber: number(t.equipmentId), truckId: number(t.equipmentId), excavatorId: number(group.excavatorId), excavatorNumber: number(group.excavatorId), team: `生产${group.team}组`, shiftId, shift: board.shift }));
                const dumpManagementAssignments = array(group.dumpManagementPeople).map(personId => ({ personId, name: name(personId), position: '排土管理', team: `生产${group.team}组`, shift: board.shift, shiftId }));
                tasks.push({ taskId, id: taskId, title: `${group.team}班组 ${board.shift}`, boardManaged: true, boardId: board.id, boardVersion: board.version, date: board.date, shiftDate: board.date, shift: board.shift, shiftId, currentShiftId: shiftId, team: `生产${group.team}组`, productionTeam: `生产${group.team}组`, status, materialType: '', material: '', area: binding.loadingPoint, loadingPoint: binding.loadingPoint, loadingZoneId: group.loadingZoneId, unloadingPoint: unload.map(z => z.zoneName || z.zone_name || z.name).join(' / '), unloadingZoneId: group.unloadingZoneIds[0], allowedUnloadingZoneIds: clone(group.unloadingZoneIds), allowedUnloadingZones: clone(unload), bindings: [binding], driverAssignments, excavatorDriverAssignments: [{ driverId: group.excavatorDriverId, driverName: name(group.excavatorDriverId), excavatorId: number(group.excavatorId), excavatorNumber: number(group.excavatorId), shiftId, shift: board.shift }], dumpManagementAssignments, auxiliaryAssignments: [], bindingHistory: group.trucks.map(t => ({ vehicleId: number(t.equipmentId), vehicleNumber: number(t.equipmentId), truckId: number(t.equipmentId), driverId: t.driverId, excavatorId: number(group.excavatorId), startAt: board.publishedAt, endAt: null })), publishedAt: board.publishedAt, updatedAt: board.updatedAt });
                executions.push({ ...clone(tasks[tasks.length - 1]), taskId, shiftId, boardManaged: true, startedAt: window.start.toISOString(), endedAt: window.end.toISOString() });
            });
            if (board.auxiliary.length) {
                const taskId = `${board.id}-AUX`;
                tasks.push({ taskId, boardId: board.id, boardManaged: true, date: board.date, shiftDate: board.date, shift: board.shift, status, publishedAt: board.publishedAt, auxiliaryAssignments: board.auxiliary.map(a => ({ vehicleId: number(a.equipmentId), vehicleNumber: number(a.equipmentId), driverId: a.driverId, driverName: name(a.driverId), team: a.team ? `生产${a.team}组` : '', type: category(data.equipment.find(e => equipmentId(e) === a.equipmentId)), work: a.work || '', workContent: a.work || '' })) });
            }
        });
        return { tasks, executions };
    }
    function tripTime(row) { return new Date(row.completedAt || row.completed_at || row.unloadedAt || row.unloaded_at || row.finishedAt || row.endTime || row.createdAt || row.created_at || row.time || row.date); }
    function validTrips(rows) {
        const seen = new Set();
        return rows.map(flatten).filter(r => {
            if (r.invalid === true || r.deleted === true || r.isValid === false || /rejected|cancelled|pending|invalid|loading|运输中|待审核|作废/.test(text(r.status || r.reviewStatus))) return false;
            if (/rejected/.test([r.gpsReviewStatus, r.reviewStatus].map(text).join(' '))) return false;
            if (/pending/.test(text(r.gpsReviewStatus || r.reviewStatus))) return false;
            if (/rejected/.test([r.confirmationStatus, r.dispatchConfirmation].map(text).join(' '))) return false;
            if ((r.dispatchConfirmation === 'pending' || r.confirmationStatus === 'pending') &&
                (r.manualOverride === true || r.gpsStatus === 'manual_override' || r.gpsReviewStatus === 'pending')) return false;
            if (!/completed|approved|finished|valid|完成|通过/.test(text(r.status)) && !r.completedAt && !r.completed_at && !r.unloadedAt && !r.unloaded_at) return false;
            const completedAt = tripTime(r);
            // Records without an immutable trip ID cannot be safely reconciled. Keep them out of official totals until manually matched.
            const id = stableTripId(r);
            if (!id || !Number.isFinite(+completedAt) || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }
    function personInShift(person, board, state, data) {
        const includesShift = value => value === board.shift || value === '白转夜' || value === '夜转白';
        const records = array(data.attendance).filter(r =>
            text(r.personId || r.person_id || r.employeeId || r.driverId) === personId(person) &&
            text(r.date || r.workDate || r.attendanceDate || r.shift_date).slice(0, 10) === board.date &&
            !/rejected|cancelled|驳回|作废/.test(text(r.status || r.reviewStatus)));
        const scheduled = records.filter(r => r.whiteUnits != null || r.nightUnits != null || r.shift || r.shiftName || r.shift_name || r.shiftType || r.workShift);
        if (scheduled.length) return scheduled.some(r => r.whiteUnits != null || r.nightUnits != null
            ? Number(board.shift === '白班' ? r.whiteUnits : r.nightUnits) > 0
            : includesShift(text(r.shift || r.shiftName || r.shift_name || r.shiftType || r.workShift)));
        const declared = text(person.workShift || person.shift || person.shiftName || person.shift_name);
        if (declared) return includesShift(declared);
        const range = interval(board.date, board.shift, state.schedule);
        const punches = array(data.attendance).filter(r => text(r.personId || r.person_id || r.employeeId || r.driverId) === personId(person) && !/rejected|cancelled|驳回|作废/.test(text(r.status || r.reviewStatus)));
        const times = punches.map(r => new Date(r.checkInAt || r.checkInTime || r.check_in_time)).filter(t => !Number.isNaN(t.getTime()));
        const day = interval(board.date, '白班', state.schedule), night = interval(board.date, '夜班', state.schedule);
        if (times.some(t => t >= day.start && t < night.end)) return times.some(t => t >= range.start && t < range.end);
        // A/B crews are independent of day/night; use the selected board's crews only as a fallback.
        const crews = new Set([...array(board.groups), ...array(board.auxiliary)].map(team).filter(Boolean));
        return Boolean(team(person) && crews.has(team(person)));
    }
    function unassignedPeople(board, state, data) {
        const used = new Set(assignments(board).people), external = occupiedElsewhere(board, state, data, state.schedule).people;
        return data.people.filter(p => approved(p) && ['truck', 'excavator', 'auxiliary', 'dump_management'].includes(role(p)) &&
            !used.has(personId(p)) && !external.has(personId(p)) && personInShift(p, board, state, data));
    }
    function statistics(date, shift, state, data, board) {
        const start = interval(date, '白班', state.schedule).start, end = interval(date, '夜班', state.schedule).end;
        const range = interval(date, shift, state.schedule);
        const daily = validTrips(data.trips).filter(r => tripTime(r) >= start && tripTime(r) < end);
        const allTasks = [...data.tasks, ...data.executions];
        const relationId = value => text(value).trim();
        const taskFor = r => {
            const shiftId = relationId(r.shiftId || r.shift_id);
            const taskId = relationId(r.taskId || r.task_id);
            if (shiftId) {
                const byShift = allTasks.find(t => relationId(t.shiftId || t.shift_id) === shiftId);
                if (byShift) return byShift;
            }
            if (taskId) return allTasks.find(t => relationId(t.taskId || t.task_id) === taskId);
            return undefined;
        };
        const tripTeam = r => team(r) || team(taskFor(r)) || team(data.people.find(p => personId(p) === text(r.driverId || r.driver_id)));
        const materialFor = r => {
            const task = taskFor(r);
            return text(r.materialType || r.material_type || r.material || task?.materialType || task?.material_type || task?.material);
        };
        const coal = r => /煤|coal/i.test(materialFor(r));
        const slag = r => /岩石|渣|rock|slag/i.test(materialFor(r));
        const used = assignments(board), equipmentSet = new Set(used.equipment), personSet = new Set(used.people);
        const equipment = data.equipment.filter(e => !/deleted|disabled|停用/.test(text(e.status)));
        const repair = equipment.filter(e => blockedEquipment(e, data));
        const dutyEquipment = equipment.filter(e => equipmentSet.has(equipmentId(e)) && !blockedEquipment(e, data));
        const people = data.people.filter(approved);
        const present = p => array(data.attendance).some(r => {
            if (text(r.personId || r.person_id || r.employeeId || r.driverId) !== personId(p)) return false;
            if (/rejected|absent|cancelled|leave_invalid|未出勤|缺勤|驳回/.test(text(r.status || r.reviewStatus || r.attendanceStatus)) || r.countAttendance === false) return false;
            if (r.batchConfirmed || r.confirmedAttendance != null) {
                const units = shift === '白班' ? Number(r.whiteUnits || 0) : Number(r.nightUnits || 0);
                return text(r.date).slice(0, 10) === date && units > 0 && Number(r.confirmedAttendance) > 0;
            }
            const explicitShift = text(r.shift || r.shiftName || r.shift_name);
            if (explicitShift && (r.date || r.workDate || r.attendanceDate || r.shift_date)) return text(r.date || r.workDate || r.attendanceDate || r.shift_date).slice(0, 10) === date && explicitShift === shift && Boolean(r.checkInAt || r.checkInTime || r.check_in_time || /approved|confirmed|present|出勤|通过|已确认/.test(text(r.status || r.attendanceStatus)));
            const time = new Date(r.checkInAt || r.checkInTime || r.check_in_time || r.createdAt);
            return time >= range.start && time < range.end;
        });
        const attendanceCount = people.filter(p => present(p) && !onLeave(p, board, data, state.schedule)).length;
        const trucks = equipment.filter(e => category(e) === 'truck');
        const aux = equipment.filter(e => !['truck', 'excavator', 'other'].includes(category(e)));
        const auxDuty = aux.filter(e => equipmentSet.has(equipmentId(e)) && !blockedEquipment(e, data)).length;
        const countDuty = list => list.filter(e => equipmentSet.has(equipmentId(e)) && !blockedEquipment(e, data)).length;
        const dumpManagers = new Set(board.groups.flatMap(g => array(g.dumpManagementPeople)).filter(Boolean));
        return { totalTrips: daily.length, aTrips: daily.filter(r => tripTeam(r) === 'A').length, bTrips: daily.filter(r => tripTeam(r) === 'B').length, coalTrips: daily.filter(coal).length, aCoal: daily.filter(r => coal(r) && tripTeam(r) === 'A').length, aSlag: daily.filter(r => slag(r) && tripTeam(r) === 'A').length, bSlag: daily.filter(r => slag(r) && tripTeam(r) === 'B').length, bCoal: daily.filter(r => coal(r) && tripTeam(r) === 'B').length, unknownTeam: daily.filter(r => !tripTeam(r)).length, shiftTrips: daily.filter(r => tripTime(r) >= range.start && tripTime(r) < range.end).length, equipmentTotal: equipment.length, equipmentDuty: dutyEquipment.length, equipmentIdle: equipment.filter(e => !equipmentSet.has(equipmentId(e)) && !blockedEquipment(e, data)).length, equipmentRepair: repair.length, equipmentRate: equipment.length ? dutyEquipment.length / equipment.length : 0, truckTotal: trucks.length, truckDuty: countDuty(trucks), truckIdle: trucks.filter(e => !equipmentSet.has(equipmentId(e)) && !blockedEquipment(e, data)).length, truckRepair: trucks.filter(e => blockedEquipment(e, data)).length, truckRate: trucks.length ? countDuty(trucks) / trucks.length : 0, personnelTotal: people.length, personnelDuty: attendanceCount, personnelIdle: people.filter(p => !personSet.has(personId(p)) && !onLeave(p, board, data, state.schedule) && !/working|作业中/.test(text(p.personnelStatus || p.personnel_status))).length, personnelLeave: people.filter(p => onLeave(p, board, data, state.schedule)).length, personnelRate: people.length ? attendanceCount / people.length : 0, productionPeople: new Set(board.groups.flatMap(g => [g.excavatorDriverId, ...g.trucks.map(t => t.driverId), ...array(g.dumpManagementPeople)]).filter(Boolean)).size, excavatorDrivers: new Set(board.groups.map(g => g.excavatorDriverId).filter(Boolean)).size, truckDrivers: new Set(board.groups.flatMap(g => g.trucks.map(t => t.driverId)).filter(Boolean)).size, dumpManagers: dumpManagers.size, auxiliaryTotal: aux.length, auxiliaryDuty: auxDuty, auxiliaryRate: aux.length ? auxDuty / aux.length : 0, auxiliaryDrivers: new Set(board.auxiliary.map(a => a.driverId).filter(Boolean)).size };
    }
    function teamDraft(board, crew) {
        if (!['A', 'B'].includes(crew)) throw new Error('请选择生产A组或生产B组。');
        const draft = clone(board);
        draft.team = crew;
        draft.groups = array(draft.groups).filter(g => g.team === crew);
        draft.auxiliary = array(draft.auxiliary).filter(a => a.team === crew);
        return draft;
    }
    function canEdit(identity, people) {
        const id = text(identity?.personId), person = people.find(p => personId(p) === id);
        if (!person || role(person) !== 'dispatch') return false;
        if (/^(pending|待审核)$/.test(text(person.status)) && !/^(approved|通过|已审核)$/.test(text(person.approvalStatus || person.approval_status))) return false;
        if (/rejected|disabled|resigned|deleted|驳回|离职|停用/.test(text(person.status) + ' ' + text(person.approvalStatus || person.approval_status) + ' ' + text(person.personnelStatus))) return false;
        return approved(person) || /^(approved|active|working)$/.test(text(person.status)) || /^(在职可用|作业中)$/.test(text(person.personnelStatus));
    }
    function dispatchIdentity(currentId, mappedId, profileId, people) {
        const current = people.find(p => personId(p) === text(currentId));
        // A rejected/pending dispatch identity must not silently switch to another dispatcher.
        if (current && role(current) === 'dispatch') return { personId: personId(current) };
        for (const id of [mappedId, profileId]) {
            if (id && canEdit({ personId: text(id) }, people)) return { personId: text(id) };
        }
        return { personId: text(currentId) };
    }
    return { DEFAULT_SCHEDULE, clone, array, text, flatten, stableTripId, hasStableTripId, personId, equipmentId, equipmentNumber, team, role, category, approved, minute, dateKey, shiftDate, validateSchedule, interval, currentSlot, slotKey, emptyBoard, emptyState, assignments, blockedEquipment, onLeave, occupiedElsewhere, equipmentChoices, personChoices, validateBoard, boardFor, projections, validTrips, personInShift, unassignedPeople, statistics, canEdit, dispatchIdentity, teamDraft };
});

