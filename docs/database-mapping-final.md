# mine-management 最终数据库映射表（V1）

> 基线：核心回归 37/37 PASS、黄金回归 6/6 PASS、功能树 19/19 全绿。
>
> 本文件只定义“现有浏览器存储 → 未来数据库/本地缓存”的归属，不修改任何生产页面。

## 一、迁移原则

1. PostgreSQL / Supabase 作为正式业务唯一数据源。
2. localStorage 只保留短期身份缓存、离线 pending queue、页面草稿、临时流程状态。
3. sessionStorage 只保留当前浏览器会话，不保存正式业务台账。
4. 所有跨页面正式业务数据统一通过 data-service.js 访问。
5. 正式业务记录优先软删除 / 状态归档，不直接物理删除。
6. 图片放对象存储，数据库保存 URL、业务 ID、上传人、上传时间。
7. 所有客户端离线写入都必须带 client_record_id，服务端建立唯一约束避免重复同步。

## 二、36 个已复核键最终归属

| 现有 Key | 最终归属 | 未来表 / 处理方式 | 说明 |
|---|---|---|---|
| generalManagerCostInputs | 正式业务数据 | finance_costs | 总经理手工补录成本统一进入财务成本表 |
| auxiliaryVehicleProfile | 本地缓存 + 正式设备主数据 | vehicles / 本地 profile cache | 正式车辆资料来自 vehicles，本地只缓存当前辅助车辆 |
| auxiliaryWorkRecords | 正式业务数据 | auxiliary_work_records | 辅助车辆作业记录 |
| generalManagerBusinessSettings | 系统配置 | general_manager_business_settings | 总经理经营参数独立单例配置 |
| penaltyRecords | 正式业务数据 | penalty_records | 罚款/处罚记录，后续参与工资扣款 |
| productionVolumeSettings | 系统配置 | production_volume_settings | 默认单车均方、车型均方独立单例配置 |
| temporaryUnloadRequests | 正式业务数据 | temporary_unload_requests | 临时卸料申请与审批闭环 |
| auxiliaryDemoTasks | 测试/演示数据 | 不进入生产数据库 | 仅用于演示/测试 |
| dispatchUserProfile | 本地会话缓存 | personnel / 本地 profile cache | 正式人员来自 personnel |
| pendingTransportZoneSelection | 本地流程缓存 | 本地缓存；最终写 transport_zones / dispatch_tasks | 仅保存未确认选择 |
| publishedDispatchTask | 正式业务数据 | dispatch_tasks | 与 dispatchPublishedTasks 归并到同一表 |
| payrollAuditLogs | 正式审计数据 | payroll_audit_logs | 工资规则/工资表修改审计 |
| payrollMonthlyLocks | 正式业务控制 | payroll_monthly_locks | 月结锁定，防止结算后被修改 |
| payrollMonthlyRecords | 正式业务数据 | payroll_monthly_records | 月度工资结果 |
| attendanceGeofenceAttempts | 正式审计数据 | attendance_geofence_attempts | 每次定位校验记录，不并入 attendance_records |
| attendanceGeofenceConfig | 系统配置 | attendance_geofence_config | 考勤围栏独立配置 |
| materialHolders | 正式业务数据 | material_holders | 可回收物资当前持有人 |
| materialLedger | 正式业务流水 | warehouse_transactions | 统一库存流水 |
| materialLostRecords | 正式业务数据 | material_loss_records | 物资遗失记录 |
| materialRecycleRecords | 正式业务数据 | material_recycle_records | 回收归还记录 |
| materialScrapRecords | 正式业务数据 | material_scrap_records | 报废记录 |
| equipmentMaintenanceRecords | 正式业务数据 | equipment_maintenance_records | 设备保养履历 |
| equipmentMaintenanceSettings | 系统配置 | equipment_maintenance_settings | 保养周期、提醒阈值等 |
| equipmentMeterReadings | 正式业务数据 | equipment_meter_readings | 里程/小时表读数 |
| maintenanceAlerts | 正式业务数据 | maintenance_alerts | 到期/异常提醒 |
| maintenanceCosts | 正式业务数据 | maintenance_costs | 维修成本明细，并汇总到 finance_costs |
| maintenanceReportDraft | 本地草稿 | 保留本地 | 未提交维修报告草稿 |
| maintenanceReports | 正式业务数据 | maintenance_reports | 已提交维修报告 |
| maintenanceWorkerDrafts | 本地草稿 | 保留本地 | 维修工未提交草稿 |
| driverCurrentTask | 本地流程缓存 | 本地缓存；正式源 dispatch_tasks | 当前任务镜像，不单独建业务主表 |
| driverLastGpsPosition | 正式事件 + 本地缓存 | gps_events / 本地 last_position cache | 本地保留最后位置，服务端存关键事件 |
| driverProfile | 本地身份缓存 | personnel / 本地 profile cache | 正式人员数据来自 personnel |
| driverTemporaryLoadingAssignment | 正式业务数据 + 本地缓存 | temporary_loading_assignments | 临时装载分配必须服务端共享 |
| driverTransportCycleState | 本地流程缓存 | 本地缓存；正式结果写 trip_records | 过程状态不单独建主表 |
| driverTripRecords | 正式业务数据 | trip_records | 与 tripRecords 归并 |
| driverVehicleChangeRequests | 正式业务数据 | vehicle_change_requests | 司机换车申请 |

## 三、已确认核心映射

| 现有 Key | 数据库表 |
|---|---|
| personnelRecords | personnel |
| dispatchPublishedTasks / publishedDispatchTask | dispatch_tasks |
| dispatchShiftExecutions | shift_executions |
| tripRecords / driverTripRecords | trip_records |
| transportZones | transport_zones |
| equipmentRecords | equipment |
| equipmentUsageChecks | equipment_checks |
| equipmentOperationalStatus | equipment_operational_status |
| maintenanceRequests | maintenance_requests |
| maintenanceWorkOrders | maintenance_orders |
| workshopBays | workshop_bays |
| warehouseMaterials | warehouse_materials |
| materialRequests | material_requests |
| attendanceRecords | attendance_records |
| leaveRequests / leaveRecords / driverLeaveRequests | leave_requests |
| zeroProductionReports | zero_production_reports |
| fuelRequests | fuel_requests |
| fuelRecords | fuel_records |
| fuelIntakeRecords | fuel_intakes |
| fuelStockAdjustments | fuel_stock_adjustments |
| fuelStationConfig | fuel_station_config |
| financeCostRecords / generalManagerCostInputs | finance_costs |
| payrollStandards | payroll_standards |
| payrollRules | payroll_rules |
| teamTransferRequests | team_transfer_requests |
| generalManagerBusinessSettings | general_manager_business_settings |
| productionVolumeSettings | production_volume_settings |

## 四、本地保留，不作为正式业务主数据

- auxiliaryVehicleProfile（当前辅助车辆本机缓存；正式主数据来自 vehicles）
- currentPersonId
- selectedPosition
- driverProfile
- dispatchUserProfile
- driverCurrentTask
- driverTransportCycleState
- pendingTransportZoneSelection
- fuelRequestDraft
- fuelRequestManualPerson
- maintenanceReportDraft
- maintenanceWorkerDrafts
- managementSession
- adminPersonId / managerPersonId / accountantPersonId
- pendingProtectedPersonId / pendingProtectedPosition
- waitingApplicantPersonId / waitingApplicantPosition
- rolePersonIds

## 五、测试/演示数据

- auxiliaryDemoTasks：仅用于辅助车辆演示/测试，不进入生产数据库。

## 六、迁移批次

### 第一批
人员 / 车辆 / 调度 / 班次 / 运输趟次 / GPS关键节点 / 设备检查 / 维修。

### 第二批
库房 / 物资 / 考勤 / 请假 / 油料 / 加油申请 / 临时卸料 / 临时装载。

### 第三批
财务成本 / 工资标准 / 月度工资 / 奖扣 / 综合报表 / 审计日志。

## 七、下一步

1. 运行 tests/data-storage-audit.js，目标：待设计 = 0、数据层封口 = PASS。
2. 保留本地身份缓存、草稿、流程镜像和测试演示数据，不再为了“清空 localStorage”而机械建表。
3. 现有正式业务数据继续统一通过 data-service.js；以后只有新增真实业务实体时才扩展数据库表。
4. 每次数据层变更后继续跑 37/37 + 6/6 + 19/19。
