(function () {
    'use strict';
    const C = window.ProductionBoardCore;
    if (!C) return;
    const KEY = 'mineProductionBoardV2';
    const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value == null ? fallback : value; } catch (_) { return fallback; } };
    const rows = key => C.array(read(key, [])).map(C.flatten);
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const id = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const pathname = location.pathname.split('/').pop();
    const isDispatchPage = pathname === 'dispatch.html';
    let state, data, selected, automatic = true, draft = null, baseRevision = 0, section, message = '', errorMessage = false;
    let dialog, timer, projectionSignature = '', collapsed = true;
    function load() {
        state = read(KEY, C.emptyState());
        if (state.schemaVersion !== 2) throw new Error('看板数据版本不兼容，请联系调度。');
        data = {
            people: rows('personnelRecords'),
            equipment: rows('equipmentRecords'),
            tasks: rows('dispatchPublishedTasks'), executions: rows('dispatchShiftExecutions'),
            zones: rows('transportZones'), operational: rows('equipmentOperationalStatus'),
            maintenance: [...rows('maintenanceRequests'), ...rows('maintenanceWorkOrders')],
            leaves: [...rows('leaveRequests'), ...rows('driverLeaveRequests')],
            attendance: [...rows('attendanceRecords'), ...rows('dispatchAttendanceConfirmations')], trips: [...rows('tripRecords'), ...rows('driverTripRecords')]
        };
        // Older catalogs occasionally store separate vehicle records; merge by equipment number.
        rows('vehicleRecords').forEach(vehicle => { if (!data.equipment.some(e => C.equipmentNumber(e) === C.equipmentNumber(vehicle))) data.equipment.push(vehicle); });
        data.equipment = data.equipment.filter((e, i, all) => all.findIndex(r => C.equipmentId(r) === C.equipmentId(e)) === i);
        if (automatic || !selected) selected = C.currentSlot(new Date(), state.schedule);
    }
    function identity() {
        const profile = read('dispatchUserProfile', {});
        const currentId = localStorage.getItem('currentPersonId') || '';
        if (!isDispatchPage) return { personId: currentId };
        const roles = read('rolePersonIds', {});
        return C.dispatchIdentity(currentId, roles['车队长'] || roles['调度员'] || roles['调度'], profile.personId || profile.employeeId, data.people);
    }
    const editable = () => isDispatchPage && C.canEdit(identity(), data.people);
    const board = () => draft || C.boardFor(state, selected.date, selected.shift, data);
    function notify(text, error = false) { message = text; errorMessage = error; render(); }
    function persist(next, action, expectedRevision) {
        load();
        if (!editable()) throw new Error('只有已审核的调度人员可以修改看板。');
        const latest = read(KEY, C.emptyState());
        if (latest.revision !== expectedRevision) throw new Error('其他页面已修改看板，请取消编辑、刷新后再调整。');
        next.revision = latest.revision + 1;
        next.audit = [...C.array(latest.audit), { action, operatorId: identity().personId, time: new Date().toISOString(), date: selected.date, shift: selected.shift }].slice(-500);
        localStorage.setItem(KEY, JSON.stringify(next));
        state = next;
        projectionSignature = '';
        refreshProjections();
        window.dispatchEvent(new CustomEvent('production-board-updated'));
    }
    function refreshProjections() {
        const now = new Date(), slot = C.currentSlot(now, state.schedule);
        const signature = `${state.revision}|${C.slotKey(slot.date, slot.shift)}`;
        if (signature === projectionSignature || !Object.values(state.boards).some(b => b.published)) return;
        const projected = C.projections(state, data, now);
        const ownedLegacy = new Set(Object.values(state.boards).flatMap(b => b.groups.map(g => g.legacyTaskId).filter(Boolean)));
        function merge(key, incoming) {
            const incomingIds = new Set(incoming.map(r => String(r.shiftId && key === 'dispatchShiftExecutions' ? r.shiftId : r.taskId)));
            const previous = rows(key).filter(r => !r.boardManaged || !incomingIds.has(String(r.shiftId && key === 'dispatchShiftExecutions' ? r.shiftId : r.taskId))).map(r => r.boardManaged || ownedLegacy.has(String(r.taskId || r.id)) ? { ...r, status: 'handed_over', supersededByBoard: true } : r);
            const value = JSON.stringify([...previous, ...incoming]);
            if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
        }
        merge('dispatchPublishedTasks', projected.tasks);
        merge('dispatchShiftExecutions', projected.executions);
        // Retire the legacy single-task publisher cache after the new board takes over.
        const legacy = read('publishedDispatchTask', null);
        if (legacy && (legacy.boardManaged || ownedLegacy.has(String(legacy.taskId || legacy.id)))) localStorage.removeItem('publishedDispatchTask');
        const current = read('driverCurrentTask', null);
        if (current && (current.boardManaged || String(current.taskId || '').startsWith('BOARD-'))) {
            const active = projected.tasks.find(t => t.taskId === current.taskId && t.status === 'active');
            if (!active) localStorage.removeItem('driverCurrentTask');
        }
        projectionSignature = signature;
        data.tasks = rows('dispatchPublishedTasks'); data.executions = rows('dispatchShiftExecutions');
    }
    const findEquipment = value => data.equipment.find(e => C.equipmentId(e) === value);
    const findPerson = value => data.people.find(p => C.personId(p) === value);
    const equipmentLabel = value => value ? C.equipmentNumber(findEquipment(value) || { id: value }) : '选择设备';
    const personLabel = value => value ? findPerson(value)?.name || value : '选择司机';
    const zoneLabel = value => { const z = data.zones.find(z => String(z.zoneId || z.zone_id || z.id) === value); return z?.zoneName || z?.zone_name || z?.name || value || '未设置'; };
    function pair(equipment, person, kind, groupIndex, index) {
        const broken = equipment && C.blockedEquipment(findEquipment(equipment) || {}, data);
        const attrs = `data-kind="${kind}" data-group="${groupIndex}" data-index="${index}"`;
        return `<div class="pb-pair ${kind === 'auxiliary' ? 'pb-aux' : kind === 'excavator' ? 'pb-excavator' : ''}">
            ${kind === 'truck' ? `<strong class="pb-muted" style="text-align:center">汽车${index + 1}</strong>` : ''}
            <button type="button" class="pb-device" data-action="${draft ? 'choose-equipment' : 'equipment-info'}" data-id="${escape(equipment)}" ${attrs}>${escape(equipmentLabel(equipment))}${broken ? ' · 维修' : ''}</button>
            <button type="button" class="pb-person" data-action="${draft ? 'choose-person' : 'person-info'}" data-id="${escape(person)}" ${attrs}>${escape(personLabel(person))}</button>
            ${draft && kind !== 'excavator' ? `<button class="pb-remove" type="button" data-action="remove-pair" ${attrs}>移除</button>` : ''}
        </div>`;
    }
    const metric = (label, value) => `<div class="pb-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
    function render() {
        if (!section) return;
        const b = board(), s = C.statistics(selected.date, selected.shift, state, data, b), current = C.currentSlot(new Date(), state.schedule);
        const date = new Date(), statisticsHidden = draft || !b.published ? ' hidden' : '';
        section.innerHTML = `<div class="pb-heading"><div><h2>生产任务看板</h2><p>按生产日期展示白班、夜班；A班组、B班组分别统计完成趟次。</p></div><span class="pb-tag">看板 V2.0.6 · 本机共享 · ${draft ? '编辑中' : editable() ? '调度' : '只读'}</span><div class="pb-actions"><button type="button" data-action="toggle" aria-expanded="${!collapsed}" aria-controls="pb-content">${collapsed ? '展开看板' : '收起看板'}</button>${collapsed && editable() && !draft ? '<button type="button" class="pb-primary" data-action="edit">' + (b.published ? '调整绑定' : '下发任务') + '</button>' : ''}</div></div>
            <div id="pb-content"${collapsed ? ' hidden' : ''}><div class="pb-toolbar"><label>生产日期 <input type="date" data-action="date" value="${escape(selected.date)}" ${draft ? 'disabled' : ''}></label><span id="pb-live-clock" class="pb-muted">${escape(date.toLocaleString('zh-CN', { hour12: false }))}</span><button type="button" data-action="auto" ${draft ? 'disabled' : ''}>${automatic ? '正在显示当前班' : '回到当前班'}</button>${editable() ? '<button type="button" data-action="schedule"' + (draft ? ' disabled' : '') + '>设置班次时间</button>' : ''}</div>
            <div class="pb-tabs">${['白班', '夜班'].map(shift => `<button type="button" data-action="shift" data-shift="${shift}" class="${shift === selected.shift ? 'pb-active' : ''}" ${draft ? 'disabled' : ''}>${shift}${current.date === selected.date && current.shift === shift ? ' · 当前班' : ''}<small>${shift === '白班' ? state.schedule.dayStart + '—' + state.schedule.dayEnd : state.schedule.nightStart + '—' + state.schedule.nightEnd} ${C.interval(selected.date, shift, state.schedule).end.getDate() !== new Date(selected.date + 'T12:00:00').getDate() ? '（次日结束）' : ''}</small></button>`).join('')}</div>
            <p>生产日：${escape(selected.date)} ${escape(state.schedule.dayStart)} 起，到次日 ${escape(state.schedule.dayStart)} 止。车数按完成趟次统计，车辆台数另列。</p>
            <div class="pb-trip-summary pb-statistics"${statisticsHidden}>${metric('当日总趟数', s.totalTrips)}<div class="pb-trip-groups"><section class="pb-trip-group"><h3>生产A组</h3>${metric('A组总趟数', s.aTrips)}<div class="pb-trip-materials">${metric('A组渣总趟数', s.aSlag)}${metric('A组煤总趟数', s.aCoal)}</div></section><section class="pb-trip-group"><h3>生产B组</h3>${metric('B组总趟数', s.bTrips)}<div class="pb-trip-materials">${metric('B组渣总趟数', s.bSlag)}${metric('B组煤总趟数', s.bCoal)}</div></section></div></div>
            <p class="pb-statistics"${statisticsHidden}>所选${escape(selected.shift)}已完成 ${s.shiftTrips} 趟${s.unknownTeam ? `；另有 ${s.unknownTeam} 趟未标明A/B班组` : ''}。</p>
            ${message ? `<div role="status" class="pb-message ${errorMessage ? 'pb-error' : ''}">${escape(message)}</div>` : ''}
            <div class="pb-section pb-statistics"${statisticsHidden}><h3>汽车</h3><div class="pb-metrics">${metric('汽车总数（辆）', s.truckTotal)}${metric('出勤作业（辆）', s.truckDuty)}${metric('空闲（辆）', s.truckIdle)}${metric('维修 / 保养（辆）', s.truckRepair)}${metric('汽车出勤率', (s.truckRate * 100).toFixed(1) + '%')}${metric('全部设备（台）', s.equipmentTotal)}</div><p>全部设备：出勤 ${s.equipmentDuty} 台 · 空闲 ${s.equipmentIdle} 台 · 维修 / 保养 ${s.equipmentRepair} 台 · 出勤率 ${(s.equipmentRate * 100).toFixed(1)}%。辅助车辆：${s.auxiliaryTotal} 辆，出勤 ${s.auxiliaryDuty} 辆，出勤率 ${(s.auxiliaryRate * 100).toFixed(1)}%。设备出勤按所选班次有效绑定计算。</p></div>
            <div class="pb-section pb-statistics"${statisticsHidden}><h3>人员</h3><div class="pb-metrics">${metric('人员总数', s.personnelTotal)}${metric('考勤出勤', s.personnelDuty)}${metric('未绑定 / 空闲', s.personnelIdle)}${metric('请假', s.personnelLeave)}${metric('人员出勤率', (s.personnelRate * 100).toFixed(1) + '%')}${metric('生产组绑定人员', s.productionPeople)}</div><p>挖机司机 ${s.excavatorDrivers} 人 · 汽车司机 ${s.truckDrivers} 人 · 辅助车辆司机 ${s.auxiliaryDrivers} 人。人员出勤按所选班次考勤记录计算，绑定与考勤分别统计。</p></div>
            <div class="pb-section"><div class="pb-heading"><h3>${escape(selected.shift)}生产组</h3>${editable() && !draft && !collapsed ? `<div class="pb-actions"><button class="pb-primary" type="button" data-action="edit">${b.published ? '调整绑定' : '下发任务'}</button></div>` : ''}</div>
            ${draft ? `<p class="pb-edit-note">编辑模式：本次调配生产${escape(draft.team)}组。点击设备或人员更换，仅显示可调配设备和空闲人员。点击“绑定并发布”后，各端显示新看板；取消不会改变现有绑定。</p>` : '<p>点击设备编号或人员姓名查看信息。白班、夜班可手动切换。</p>'}
            ${!b.groups.length ? '<div class="pb-empty">该班次尚未设置生产组。</div>' : b.groups.map((g, gi) => `<div class="pb-group"><div class="pb-group-label">${gi + 1}组<small>${escape(g.team || '未设置')}班组</small><small>跟随汽车 ${g.trucks.length} 辆</small>${draft ? `<button type="button" class="pb-danger" data-action="remove-group" data-group="${gi}">删除组</button>` : ''}</div><div class="pb-assignment-grid">${pair(g.excavatorId, g.excavatorDriverId, 'excavator', gi, 0)}${g.trucks.map((t, ti) => pair(t.equipmentId, t.driverId, 'truck', gi, ti)).join('')}${draft ? `<button type="button" class="pb-add" data-action="add-truck" data-group="${gi}" aria-label="添加汽车">+</button>` : ''}</div><div class="pb-zones"><strong>装卸区域</strong><br>装载区：${escape(zoneLabel(g.loadingZoneId))}<br>${g.unloadingZoneIds.length ? g.unloadingZoneIds.map((zone, i) => `卸载区${i + 1}：${escape(zoneLabel(zone))}`).join('<br>') : '未设置卸载区'}${draft ? `<button type="button" class="pb-zone-edit" data-action="group-settings" data-group="${gi}">区域设置</button>` : ''}</div></div>`).join('')}
            ${draft ? '<button type="button" class="pb-full-add" data-action="add-group">＋ 添加生产组</button>' : ''}</div>
            <div class="pb-section"><h3>辅助车辆</h3><div class="pb-assignment-grid">${b.auxiliary.map((a, ai) => `<div class="pb-aux-item">${pair(a.equipmentId, a.driverId, 'auxiliary', -1, ai)}${draft ? `<button type="button" data-action="aux-settings" data-index="${ai}">作业内容</button>` : `<p>${escape(a.work || '未填写作业内容')}</p>`}</div>`).join('')}${draft ? '<button type="button" class="pb-add" data-action="add-aux" aria-label="添加辅助车辆">+</button>' : ''}${!b.auxiliary.length && !draft ? '<p>该班次未绑定辅助车辆。</p>' : ''}</div></div>
            <div class="pb-section"><h3>未进入分配的车辆 / 设备</h3><p>绿色为可调配；红色为维修、保养或停用。点击编号查看信息。</p><div class="pb-unassigned">${unassignedEquipment(b)}</div></div>
            <div class="pb-section"><h3>未进入分配的人员</h3><p>仅显示所选${escape(selected.shift)}的未分配一线司机。</p><div class="pb-unassigned">${unassignedPeople(b)}</div></div>
            ${draft ? '<div class="pb-editor-footer"><button type="button" data-action="cancel">取消编辑</button><button type="button" class="pb-primary" data-action="publish">绑定并发布</button></div>' : `<p class="pb-muted">${b.published ? `已绑定 · 版本 ${b.version || '旧任务导入'} · ${escape(b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : '')}` : '尚未绑定'}。班次时间和任务仅由调度设置。</p>`}</div>`;
    }
    function unassignedEquipment(b) {
        const used = new Set(C.assignments(b).equipment), external = C.occupiedElsewhere(b, state, data, state.schedule).equipment;
        return data.equipment.filter(e => !used.has(C.equipmentId(e)) && !external.has(C.equipmentId(e))).map(e => {
            const broken = C.blockedEquipment(e, data) || /停用|disabled/.test(String(e.status));
            return `<button type="button" data-action="equipment-info" data-id="${escape(C.equipmentId(e))}" class="${broken ? 'pb-repair' : ''}">${escape(C.equipmentNumber(e))} · ${broken ? '维修 / 不可调配' : '可调配'}</button>`;
        }).join('') || '<span class="pb-muted">暂无未分配设备。</span>';
    }
    function unassignedPeople(b) {

        const used = new Set(C.assignments(b).people), external = C.occupiedElsewhere(b, state, data, state.schedule).people;
        const people = draft ? data.people.filter(p => C.approved(p) && ['truck', 'excavator', 'auxiliary'].includes(C.role(p)) && C.team(p) === draft.team && !used.has(C.personId(p)) && !external.has(C.personId(p))) : C.unassignedPeople(b, state, data);
        return people.map(p => { const unavailable = C.onLeave(p, b, data, state.schedule) || /working|作业中/.test(String(p.personnelStatus || p.personnel_status)); return `<button type="button" data-action="person-info" data-id="${escape(C.personId(p))}" class="${unavailable ? 'pb-repair' : ''}">${escape(p.name || C.personId(p))} · ${escape(p.position || '')} · ${C.team(p) || '未分组'} · ${unavailable ? '请假 / 不可调配' : '空闲'}</button>`; }).join('') || '<span class="pb-muted">本班暂无未分配的一线人员。</span>';
    }
    function modal(title, content, save) {
        if (dialog.open) dialog.close();
        dialog.innerHTML = `<form method="dialog"><h3>${escape(title)}</h3>${content}<div id="pb-dialog-error" class="pb-message pb-error" hidden></div><div class="pb-dialog-actions"><button type="button" data-close>关闭</button>${save ? '<button type="submit" class="pb-primary">确认</button>' : ''}</div></form>`;
        dialog.querySelector('[data-close]').onclick = () => dialog.close();
        dialog.querySelector('form').onsubmit = event => {
            event.preventDefault();
            if (!save) return dialog.close();
            try { save(new FormData(event.target)); dialog.close(); render(); } catch (e) { const error = dialog.querySelector('#pb-dialog-error'); error.hidden = false; error.textContent = e.message; }
        };
        dialog.showModal();
    }
    function details(type, value) {
        const row = type === 'equipment' ? findEquipment(value) : findPerson(value);
        if (!row) return notify('尚未选择或无法找到对应档案。', true);
        const fields = type === 'equipment' ? [ ['设备编号', C.equipmentNumber(row)], ['设备类型', row.equipmentType || row.vehicleType || row.type], ['型号', row.model], ['状态', C.blockedEquipment(row, data) ? '维修 / 保养，不可调配' : row.equipmentStatus || row.currentStatus || row.status || '可用'], ['所属班组', C.team(row) || '未设置'], ['小时数 / 里程', row.hours || row.hourMeter || row.mileage || '未记录'] ] : [ ['姓名', row.name], ['员工编号', row.employeeNo || row.employee_no || row.employeeId || C.personId(row)], ['岗位', row.position], ['班组', C.team(row) || '未设置'], ['状态', row.personnelStatus || row.personnel_status || row.status] ];
        modal(type === 'equipment' ? '设备信息' : '人员信息', '<dl>' + fields.map(([name, v]) => `<dt>${escape(name)}</dt><dd>${escape(v || '未填写')}</dd>`).join('') + '</dl>');
    }
    function beginEdit() {
        load();
        if (!editable()) return notify('请以已审核的车队长 / 调度身份进入调度端。', true);
        if (draft) return;
        modal('选择本班生产班组', '<p>选择本次工作班组。发布后，该班次只保留所选班组任务；取消编辑不改变原任务。</p><label>生产班组<select name="team" required><option value="">请选择</option><option value="A">生产A组</option><option value="B">生产B组</option></select></label>', form => {
            load();
            if (!editable()) throw new Error('只有已审核的调度可以下发任务。');
            draft = C.teamDraft(C.boardFor(state, selected.date, selected.shift, data), form.get('team'));
            automatic = false; collapsed = false; baseRevision = state.revision;
            message = ''; section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
    function target(attrs) {
        const gi = Number(attrs.group), index = Number(attrs.index);
        return attrs.kind === 'auxiliary' ? draft.auxiliary[index] : attrs.kind === 'excavator' ? draft.groups[gi] : draft.groups[gi].trucks[index];
    }
    function choose(attrs, type) {
        if (!draft || !editable()) return;
        load();
        const item = target(attrs), equipmentField = attrs.kind === 'excavator' ? 'excavatorId' : 'equipmentId', personField = attrs.kind === 'excavator' ? 'excavatorDriverId' : 'driverId';
        const selectedId = type === 'equipment' ? item[equipmentField] : item[personField];
        const team = attrs.kind === 'auxiliary' ? item.team : draft.groups[Number(attrs.group)].team;
        const choices = type === 'equipment' ? C.equipmentChoices(attrs.kind, draft, state, data, selectedId) : C.personChoices(attrs.kind, team, draft, state, data, selectedId);
        const options = choices.map(row => { const value = type === 'equipment' ? C.equipmentId(row) : C.personId(row); return `<option value="${escape(value)}" ${value === selectedId ? 'selected' : ''}>${escape(type === 'equipment' ? C.equipmentNumber(row) : `${row.name} · ${row.employeeNo || row.employeeId || value} · ${C.team(row) || '未分组'}`)}</option>`; }).join('');
        modal(type === 'equipment' ? '选择可调配设备' : '选择空闲人员', `<p>只显示符合岗位、班组且未被其他位置占用的资源。</p><label>${type === 'equipment' ? '设备' : '人员'}<select name="value" required><option value="">请选择</option>${options}</select></label>${!choices.length ? '<p>没有可选资源，请先审核档案、检查请假 / 维修状态或调整其他绑定。</p>' : ''}`, form => {
            if (!form.get('value')) throw new Error('请选择一个资源。');
            item[type === 'equipment' ? equipmentField : personField] = form.get('value');
        });
    }
    function groupSettings(index) {
        const g = draft.groups[index];
        const zoneId = z => String(z.zoneId || z.zone_id || z.id);
        const type = z => String(z.zoneType || z.zone_type || z.type);
        modal('生产组设置', `<p>本次调配：生产${escape(draft.team)}组</p><label>装载区<select name="load" required><option value="">请选择</option>${data.zones.filter(z => /^(loading|load|装载区|装料区)$/.test(type(z))).map(z => `<option value="${escape(zoneId(z))}" ${zoneId(z) === g.loadingZoneId ? 'selected' : ''}>${escape(zoneLabel(zoneId(z)))}</option>`).join('')}</select></label><fieldset><legend>允许卸载区（可多选）</legend>${data.zones.filter(z => /^(unloading|unload|卸载区|卸料区)$/.test(type(z))).map(z => `<label><input type="checkbox" name="unload" value="${escape(zoneId(z))}" ${g.unloadingZoneIds.includes(zoneId(z)) ? 'checked' : ''}>${escape(zoneLabel(zoneId(z)))}</label>`).join('') || '<p>请先到运输区域管理中建立卸载区。</p>'}</fieldset>`, form => {
            if (!form.get('load') || !form.getAll('unload').length) throw new Error('请选择一个装载区和至少一个卸载区。');
            g.team = draft.team; g.loadingZoneId = form.get('load'); g.unloadingZoneIds = form.getAll('unload');
        });
    }
    function schedule() {
        if (!editable() || draft) return;
        const revision = state.revision;
        modal('设置白班、夜班时间', '<p>白班、夜班覆盖24小时。结束时间不晚于开始时间时按次日结束；夜班归属白班开始的生产日期。</p><div class="pb-schedule-grid">' + [['dayStart', '白班开始'], ['dayEnd', '白班结束'], ['nightStart', '夜班开始'], ['nightEnd', '夜班结束']].map(([key, label]) => `<label>${label}<input type="time" name="${key}" value="${escape(state.schedule[key])}" required></label>`).join('') + '</div>', form => {
            const nextSchedule = Object.fromEntries(['dayStart', 'dayEnd', 'nightStart', 'nightEnd'].map(key => [key, form.get(key)]));
            C.validateSchedule(nextSchedule);
            const next = C.clone(state); next.schedule = nextSchedule;
            persist(next, '设置班次时间', revision); automatic = true; load(); message = '班次时间已保存，已切换到当前班。';
        });
    }
    function publish() {
        load();
        if (!editable()) throw new Error('只有调度可以绑定或调整。');
        if (!draft) return;
        if (state.revision !== baseRevision) throw new Error('看板已经被其他页面修改，请取消编辑后重新进入。');
        C.validateBoard(draft, state, data);
        const next = C.clone(state), now = new Date().toISOString(), saved = C.clone(draft);
        saved.published = true; saved.version = (saved.version || 0) + 1; saved.updatedAt = now; saved.publishedAt = saved.publishedAt || now; saved.operatorId = identity().personId;
        saved.history = [...C.array(saved.history), { version: saved.version, at: now, operatorId: identity().personId, groups: C.clone(saved.groups), auxiliary: C.clone(saved.auxiliary) }];
        next.boards[C.slotKey(saved.date, saved.shift)] = saved;
        persist(next, '绑定并发布', baseRevision); draft = null; load(); notify('绑定已发布。同一浏览器内各岗位端会显示这份看板。');
    }
    function action(event) {
        const button = event.target.closest('[data-action]');
        if (!button || !section.contains(button)) return;
        const a = button.dataset.action;
        try {
            if (a === 'toggle') { collapsed = !collapsed; return render(); }
            if (a === 'equipment-info') return details('equipment', button.dataset.id);
            if (a === 'person-info') return details('person', button.dataset.id);
            if (a === 'auto') { if (draft) return; automatic = true; load(); message = ''; return render(); }
            if (a === 'shift') { if (draft) return; automatic = false; selected.shift = button.dataset.shift; message = ''; return render(); }
            if (a === 'edit') return beginEdit();
            if (a === 'schedule') return schedule();
            if (!draft || !editable()) return;
            if (a === 'choose-equipment') return choose(button.dataset, 'equipment');
            if (a === 'choose-person') return choose(button.dataset, 'person');
            if (a === 'group-settings') return groupSettings(Number(button.dataset.group));
            if (a === 'add-group') draft.groups.push({ id: id(), team: draft.team, excavatorId: '', excavatorDriverId: '', trucks: [], loadingZoneId: '', unloadingZoneIds: [] });
            if (a === 'remove-group') draft.groups.splice(Number(button.dataset.group), 1);
            if (a === 'add-truck') draft.groups[Number(button.dataset.group)].trucks.push({ equipmentId: '', driverId: '' });
            if (a === 'add-aux') draft.auxiliary.push({ equipmentId: '', driverId: '', team: draft.team, work: '' });
            if (a === 'remove-pair') { if (button.dataset.kind === 'auxiliary') draft.auxiliary.splice(Number(button.dataset.index), 1); else draft.groups[Number(button.dataset.group)].trucks.splice(Number(button.dataset.index), 1); }
            if (a === 'aux-settings') { const item = draft.auxiliary[Number(button.dataset.index)]; return modal('辅助车辆作业', `<p>本次调配：生产${escape(draft.team)}组</p><label>作业内容<input name="work" maxlength="200" value="${escape(item.work)}"></label>`, form => { item.team = draft.team; item.work = form.get('work').trim(); }); }
            if (a === 'cancel') { draft = null; message = ''; }
            if (a === 'publish') return publish();
            render();
        } catch (e) { notify(e.message, true); }
    }
    function refresh() {
        try {
            const old = selected && C.slotKey(selected.date, selected.shift);
            load(); refreshProjections();
            if (!draft && !dialog.open) render();
            else { const clock = section.querySelector('#pb-live-clock'); if (clock) clock.textContent = new Date().toLocaleString('zh-CN', { hour12: false }); }
            if (old && old !== C.slotKey(selected.date, selected.shift) && !draft) message = '';
        } catch (e) { notify(e.message, true); }
    }
    function mount() {
        section = document.getElementById('production-board');
        if (!section) {
            section = document.createElement('section'); section.id = 'production-board';
            const main = document.querySelector('main') || document.querySelector('.container') || document.body;
            if (main === document.body) { const header = document.querySelector('header'); if (header) header.after(section); else main.prepend(section); }
            else main.prepend(section);
        }
        section.classList.add('production-board');
        // Work-chat creates the shared shortcut section dynamically on some pages.
        const shortcuts = () => document.getElementById('mineBottomQuickActions');
        const moveAboveShortcuts = () => {
            const quick = shortcuts();
            if (!quick) return false;
            if (quick.previousElementSibling !== section) quick.before(section);
            return true;
        };
        if (!moveAboveShortcuts()) {
            const heading = Array.from(document.querySelectorAll('h2,h3')).find(h => /快捷功能|快捷入口|快捷操作/.test(h.textContent));
            const quick = heading?.closest('section,.card') || document.querySelector('.admin-quick-entry-grid');
            if (quick && quick !== section && !quick.contains(section)) quick.before(section);
            const observer = new MutationObserver(() => { if (moveAboveShortcuts()) observer.disconnect(); });
            observer.observe(document.body, { childList: true, subtree: true });
            window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
        }

        dialog = document.createElement('dialog'); dialog.className = 'pb-dialog'; dialog.setAttribute('aria-label', '生产看板操作'); document.body.appendChild(dialog);
        dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
        section.addEventListener('click', action);
        section.addEventListener('change', event => { if (event.target.dataset.action === 'date' && !draft && event.target.value) { automatic = false; selected.date = event.target.value; message = ''; render(); } });
        document.getElementById('newTaskButton')?.addEventListener('click', beginEdit);
        window.addEventListener('storage', refresh); window.addEventListener('focus', refresh);
        window.addEventListener('production-board-updated', refresh);
        refresh(); timer = setInterval(refresh, 5000);
        window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    }
    window.MineProductionBoard = { refresh, beginEdit, storageKey: KEY };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
