"use strict";

/*
=========================================================
mine-management unified data service
Version: V1 bootstrap
Purpose:
1. Provide one access layer for localStorage today.
2. Reserve a Supabase/PostgreSQL adapter for later.
3. Add offline pending queue + client_record_id de-duplication.
4. Do NOT switch any production page yet.
=========================================================
*/

(function (global) {

    const CONFIG = {
        mode:
            "local",

        supabaseUrl:
            "",

        supabaseAnonKey:
            "",

        queueKey:
            "mineDataPendingQueue",

        clientIdKey:
            "mineDataClientId",

        supabaseConfigKey:
            "mineDataSupabaseConfig",

        supabaseAuthKey:
            "mineDataSupabaseAuthSession",

        debug:
            false
    };


    const TABLE_KEY_MAP = {
        personnel:
            "personnelRecords",

        vehicles:
            "vehicleRecords",

        dispatch_tasks:
            "dispatchPublishedTasks",

        shift_executions:
            "dispatchShiftExecutions",

        trip_records:
            "tripRecords",

        transport_zones:
            "transportZones",

        gps_events:
            "gpsEvents",

        equipment:
            "equipmentRecords",

        equipment_checks:
            "equipmentUsageChecks",

        equipment_operational_status:
            "equipmentOperationalStatus",

        maintenance_requests:
            "maintenanceRequests",

        maintenance_orders:
            "maintenanceWorkOrders",

        workshop_bays:
            "workshopBays",

        warehouse_materials:
            "warehouseMaterials",

        material_requests:
            "materialRequests",

        attendance_records:
            "attendanceRecords",

        leave_requests:
            "leaveRequests",

        zero_production_reports:
            "zeroProductionReports",

        fuel_requests:
            "fuelRequests",

        fuel_records:
            "fuelRecords",

        fuel_intakes:
            "fuelIntakeRecords",

        fuel_stock_adjustments:
            "fuelStockAdjustments",

        fuel_station_config:
            "fuelStationConfig",

        finance_costs:
            "financeCostRecords",

        payroll_standards:
            "payrollStandards",

        payroll_rules:
            "payrollRules",

        team_transfer_requests:
            "teamTransferRequests",

        temporary_unload_requests:
            "temporaryUnloadRequests",

        temporary_loading_assignments:
            "driverTemporaryLoadingAssignment",

        auxiliary_work_records:
            "auxiliaryWorkRecords",

        penalty_records:
            "penaltyRecords",

        reward_records:
            "rewardRecords",

        overtime_records:
            "overtimeRecords",

        payroll_monthly_records:
            "payrollMonthlyRecords",

        payroll_monthly_locks:
            "payrollMonthlyLocks",

        payroll_audit_logs:
            "payrollAuditLogs",

        attendance_geofence_attempts:
            "attendanceGeofenceAttempts",

        attendance_geofence_config:
            "attendanceGeofenceConfig",

        material_holders:
            "materialHolders",

        warehouse_transactions:
            "materialLedger",

        material_loss_records:
            "materialLostRecords",

        material_recycle_records:
            "materialRecycleRecords",

        material_scrap_records:
            "materialScrapRecords",

        equipment_maintenance_records:
            "equipmentMaintenanceRecords",

        equipment_maintenance_settings:
            "equipmentMaintenanceSettings",

        equipment_meter_readings:
            "equipmentMeterReadings",

        maintenance_alerts:
            "maintenanceAlerts",

        maintenance_costs:
            "maintenanceCosts",

        maintenance_reports:
            "maintenanceReports",

        vehicle_change_requests:
            "driverVehicleChangeRequests",

        general_manager_business_settings:
            "generalManagerBusinessSettings",

        production_volume_settings:
            "productionVolumeSettings",

        system_settings:
            "mineSystemSettings"
    };


    function loadSavedSupabaseConfig() {

        const saved =
            safeParse(
                localStorage.getItem(
                    CONFIG.supabaseConfigKey
                ),
                {}
            );


        if (
            saved &&
            typeof saved ===
                "object"
        ) {

            CONFIG.supabaseUrl =
                String(
                    saved.url ||
                    ""
                )
                    .trim();


            CONFIG.supabaseAnonKey =
                String(
                    saved.anonKey ||
                    ""
                )
                    .trim();
        }
    }


    function saveSupabaseConfig() {

        localStorage.setItem(
            CONFIG.supabaseConfigKey,
            JSON.stringify({
                url:
                    CONFIG.supabaseUrl,

                anonKey:
                    CONFIG.supabaseAnonKey
            })
        );
    }


        const CLIENT_RECORD_ID_TABLES =
        new Set([
            "audit_logs",
            "dispatch_tasks",
            "trip_records",
            "gps_events",
            "auxiliary_work_records",
            "equipment_checks",
            "equipment_meter_readings",
            "warehouse_transactions",
            "attendance_records",
            "fuel_intakes",
            "fuel_requests",
            "fuel_records"
        ]);


    function readAuthSession() {

        return safeParse(
            localStorage.getItem(
                CONFIG.supabaseAuthKey
            ),
            null
        );
    }


    function writeAuthSession(
        session
    ) {

        if (
            session
        ) {

            localStorage.setItem(
                CONFIG.supabaseAuthKey,
                JSON.stringify(
                    session
                )
            );

        } else {

            localStorage.removeItem(
                CONFIG.supabaseAuthKey
            );
        }
    }


    function getAuthInfo() {

        const session =
            readAuthSession();


        return {
            signedIn:
                Boolean(
                    session?.access_token
                ),

            userId:
                session?.user?.id ||
                "",

            email:
                session?.user?.email ||
                "",

            expiresAt:
                session?.expires_at ||
                null
        };
    }


    async function signInWithPassword({
        email,
        password
    }) {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            throw new Error(
                "Supabase 尚未配置"
            );
        }


        const url =
            CONFIG.supabaseUrl
                .replace(
                    /\/$/,
                    ""
                ) +
            "/auth/v1/token?grant_type=password";


        const response =
            await fetch(
                url,
                {
                    method:
                        "POST",

                    headers: {
                        apikey:
                            CONFIG.supabaseAnonKey,

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            email:
                                String(
                                    email ||
                                    ""
                                )
                                    .trim(),

                            password:
                                String(
                                    password ||
                                    ""
                                )
                        })
                }
            );


        const text =
            await response.text();


        const data =
            safeParse(
                text,
                {}
            );


        if (
            !response.ok
        ) {

            throw new Error(
                data?.msg ||
                data?.error_description ||
                data?.message ||
                (
                    "Supabase Auth 登录失败 " +
                    response.status
                )
            );
        }


        writeAuthSession(
            data
        );


        return {
            ok:
                true,

            user:
                clone(
                    data.user
                ),

            auth:
                getAuthInfo()
        };
    }


    async function signOutAuth() {

        const session =
            readAuthSession();


        if (
            session?.access_token &&
            SupabaseAdapter.isConfigured()
        ) {

            try {

                await fetch(
                    CONFIG.supabaseUrl
                        .replace(
                            /\/$/,
                            ""
                        ) +
                    "/auth/v1/logout",

                    {
                        method:
                            "POST",

                        headers: {
                            apikey:
                                CONFIG.supabaseAnonKey,

                            Authorization:
                                "Bearer " +
                                session.access_token
                        }
                    }
                );

            } catch (
                error
            ) {}
        }


        writeAuthSession(
            null
        );


        return {
            ok:
                true,

            auth:
                getAuthInfo()
        };
    }


    function log() {

        if (
            !CONFIG.debug
        ) {

            return;
        }


        console.log(
            "[DataService]",
            ...arguments
        );
    }


    function safeParse(
        value,
        fallback
    ) {

        if (
            value ===
                null ||
            value ===
                undefined ||
            value ===
                ""
        ) {

            return fallback;
        }


        try {

            return JSON.parse(
                value
            );

        } catch (
            error
        ) {

            return fallback;
        }
    }


    function clone(
        value
    ) {

        if (
            value ===
                undefined
        ) {

            return undefined;
        }


        return JSON.parse(
            JSON.stringify(
                value
            )
        );
    }


    function createId(
        prefix =
            "REC"
    ) {

        const randomPart =
            Math.random()
                .toString(
                    36
                )
                .slice(
                    2,
                    10
                );


        return (
            String(
                prefix ||
                "REC"
            ) +
            "-" +
            Date.now() +
            "-" +
            randomPart
        );
    }


    function getClientId() {

        let id =
            localStorage.getItem(
                CONFIG.clientIdKey
            );


        if (
            !id
        ) {

            id =
                createId(
                    "CLIENT"
                );


            localStorage.setItem(
                CONFIG.clientIdKey,
                id
            );
        }


        return id;
    }


    function getStorageKey(
        table
    ) {

        const key =
            TABLE_KEY_MAP[
                table
            ];


        if (
            !key
        ) {

            throw new Error(
                "DataService: 未登记的数据表 " +
                table
            );
        }


        return key;
    }


    function readRaw(
        table
    ) {

        const key =
            getStorageKey(
                table
            );


        const value =
            localStorage.getItem(
                key
            );


        if (
            table ===
                "fuel_station_config" ||
            table ===
                "payroll_rules" ||
            table ===
                "attendance_geofence_config" ||
            table ===
                "general_manager_business_settings" ||
            table ===
                "production_volume_settings" ||
            table ===
                "system_settings"
        ) {

            return safeParse(
                value,
                {}
            );
        }


        return safeParse(
            value,
            []
        );
    }


    function writeRaw(
        table,
        value
    ) {

        const key =
            getStorageKey(
                table
            );


        localStorage.setItem(
            key,
            JSON.stringify(
                value
            )
        );


        return clone(
            value
        );
    }


    // Keep this allow-list aligned with database/database-schema.sql. Unknown fields
    // are preserved in a table's JSONB extra column when available; otherwise writes fail
    // before any network request instead of sending invalid PostgREST columns.
    const REMOTE_SCHEMA_COLUMNS = {
            "audit_logs": [
                    "id",
                    "entity_type",
                    "entity_id",
                    "action",
                    "actor_person_id",
                    "before_data",
                    "after_data",
                    "client_record_id",
                    "created_at"
            ],
            "system_settings": [
                    "setting_key",
                    "setting_value",
                    "updated_by",
                    "updated_at"
            ],
            "general_manager_business_settings": [
                    "singleton_id",
                    "report_month",
                    "comprehensive_unit_price",
                    "updated_at"
            ],
            "production_volume_settings": [
                    "singleton_id",
                    "default_volume_per_trip",
                    "vehicle_models",
                    "updated_at"
            ],
            "personnel": [
                    "person_id",
                    "auth_user_id",
                    "employee_no",
                    "name",
                    "position",
                    "department",
                    "team",
                    "phone",
                    "status",
                    "approval_status",
                    "personnel_status",
                    "enabled",
                    "extra",
                    "created_at",
                    "updated_at"
            ],
            "vehicles": [
                    "vehicle_id",
                    "vehicle_number",
                    "vehicle_type",
                    "model",
                    "team",
                    "status",
                    "current_driver_id",
                    "extra",
                    "created_at",
                    "updated_at"
            ],
            "team_transfer_requests": [
                    "request_id",
                    "person_id",
                    "from_team",
                    "to_team",
                    "reason",
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "created_at"
            ],
            "vehicle_change_requests": [
                    "request_id",
                    "driver_id",
                    "from_vehicle_id",
                    "to_vehicle_id",
                    "reason",
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "created_at"
            ],
            "transport_zones": [
                    "zone_id",
                    "zone_name",
                    "zone_type",
                    "latitude",
                    "longitude",
                    "radius_m",
                    "geometry_data",
                    "status",
                    "created_at",
                    "updated_at"
            ],
            "dispatch_tasks": [
                    "task_id",
                    "task_type",
                    "title",
                    "driver_id",
                    "vehicle_id",
                    "load_zone_id",
                    "unload_zone_id",
                    "status",
                    "priority",
                    "published_by",
                    "published_at",
                    "started_at",
                    "completed_at",
                    "client_record_id",
                    "extra",
                    "created_at",
                    "updated_at"
            ],
            "shift_executions": [
                    "shift_id",
                    "shift_date",
                    "shift_name",
                    "driver_id",
                    "vehicle_id",
                    "task_id",
                    "status",
                    "started_at",
                    "ended_at",
                    "extra",
                    "created_at"
            ],
            "trip_records": [
                    "trip_id",
                    "task_id",
                    "shift_id",
                    "driver_id",
                    "vehicle_id",
                    "load_zone_id",
                    "unload_zone_id",
                    "loaded_at",
                    "unloaded_at",
                    "completed_at",
                    "status",
                    "payload_amount",
                    "client_record_id",
                    "extra",
                    "created_at"
            ],
            "gps_events": [
                    "id",
                    "person_id",
                    "vehicle_id",
                    "task_id",
                    "event_type",
                    "latitude",
                    "longitude",
                    "accuracy_m",
                    "speed_kph",
                    "zone_id",
                    "client_record_id",
                    "recorded_at"
            ],
            "temporary_unload_requests": [
                    "request_id",
                    "task_id",
                    "driver_id",
                    "vehicle_id",
                    "requested_zone_text",
                    "latitude",
                    "longitude",
                    "reason",
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "created_at"
            ],
            "temporary_loading_assignments": [
                    "assignment_id",
                    "driver_id",
                    "vehicle_id",
                    "task_id",
                    "loading_source",
                    "status",
                    "starts_at",
                    "ends_at",
                    "created_at"
            ],
            "auxiliary_work_records": [
                    "record_id",
                    "person_id",
                    "vehicle_id",
                    "work_type",
                    "work_area",
                    "quantity",
                    "unit",
                    "status",
                    "started_at",
                    "completed_at",
                    "remark",
                    "client_record_id",
                    "created_at"
            ],
            "equipment": [
                    "equipment_id",
                    "equipment_number",
                    "equipment_type",
                    "model",
                    "status",
                    "current_meter",
                    "extra",
                    "created_at",
                    "updated_at"
            ],
            "equipment_checks": [
                    "check_id",
                    "equipment_id",
                    "checker_person_id",
                    "result",
                    "abnormal_items",
                    "remark",
                    "checked_at",
                    "client_record_id"
            ],
            "equipment_operational_status": [
                    "equipment_id",
                    "operational_status",
                    "locked",
                    "lock_reason",
                    "updated_at"
            ],
            "equipment_meter_readings": [
                    "reading_id",
                    "equipment_id",
                    "meter_type",
                    "reading_value",
                    "recorded_by",
                    "recorded_at",
                    "client_record_id"
            ],
            "equipment_maintenance_settings": [
                    "equipment_id",
                    "interval_hours",
                    "interval_km",
                    "warning_before_hours",
                    "warning_before_km",
                    "settings",
                    "updated_at"
            ],
            "equipment_maintenance_records": [
                    "maintenance_record_id",
                    "equipment_id",
                    "maintenance_type",
                    "meter_value",
                    "description",
                    "performed_by",
                    "performed_at",
                    "next_due_at",
                    "created_at"
            ],
            "maintenance_requests": [
                    "request_id",
                    "equipment_id",
                    "requested_by",
                    "source_check_id",
                    "description",
                    "severity",
                    "status",
                    "approved_by",
                    "approved_at",
                    "created_at"
            ],
            "workshop_bays": [
                    "bay_id",
                    "bay_name",
                    "status",
                    "current_order_id",
                    "updated_at"
            ],
            "maintenance_orders": [
                    "order_id",
                    "request_id",
                    "equipment_id",
                    "bay_id",
                    "assigned_worker_id",
                    "status",
                    "started_at",
                    "completed_at",
                    "accepted_at",
                    "result",
                    "created_at"
            ],
            "maintenance_reports": [
                    "report_id",
                    "order_id",
                    "equipment_id",
                    "worker_id",
                    "summary",
                    "details",
                    "submitted_at"
            ],
            "maintenance_alerts": [
                    "alert_id",
                    "equipment_id",
                    "alert_type",
                    "message",
                    "status",
                    "due_at",
                    "created_at",
                    "resolved_at"
            ],
            "maintenance_costs": [
                    "cost_id",
                    "order_id",
                    "equipment_id",
                    "cost_type",
                    "amount",
                    "remark",
                    "incurred_at"
            ],
            "warehouse_materials": [
                    "material_id",
                    "code",
                    "name",
                    "category",
                    "spec",
                    "unit",
                    "material_type",
                    "available_qty",
                    "status",
                    "updated_at"
            ],
            "material_requests": [
                    "request_id",
                    "person_id",
                    "material_id",
                    "request_quantity",
                    "request_type",
                    "purpose",
                    "remark",
                    "status",
                    "actual_quantity",
                    "reviewed_by",
                    "reviewed_at",
                    "created_at"
            ],
            "warehouse_transactions": [
                    "transaction_id",
                    "material_id",
                    "transaction_type",
                    "quantity",
                    "request_id",
                    "person_id",
                    "reference_type",
                    "reference_id",
                    "remark",
                    "client_record_id",
                    "created_at"
            ],
            "material_holders": [
                    "holder_id",
                    "material_id",
                    "person_id",
                    "quantity",
                    "assigned_at",
                    "returned_at",
                    "status"
            ],
            "material_loss_records": [
                    "loss_id",
                    "material_id",
                    "person_id",
                    "quantity",
                    "reason",
                    "compensation_amount",
                    "status",
                    "created_at"
            ],
            "material_recycle_records": [
                    "recycle_id",
                    "material_id",
                    "person_id",
                    "quantity",
                    "condition_text",
                    "created_at"
            ],
            "material_scrap_records": [
                    "scrap_id",
                    "material_id",
                    "quantity",
                    "reason",
                    "approved_by",
                    "created_at"
            ],
            "attendance_geofence_config": [
                    "config_id",
                    "enabled",
                    "name",
                    "latitude",
                    "longitude",
                    "radius_m",
                    "max_accuracy_m",
                    "updated_by",
                    "updated_at"
            ],
            "attendance_records": [
                    "attendance_id",
                    "person_id",
                    "attendance_date",
                    "check_in_at",
                    "check_out_at",
                    "attendance_status",
                    "check_in_snapshot",
                    "check_out_snapshot",
                    "client_record_id",
                    "created_at"
            ],
            "attendance_geofence_attempts": [
                    "attempt_id",
                    "person_id",
                    "action_type",
                    "valid",
                    "latitude",
                    "longitude",
                    "accuracy_m",
                    "distance_m",
                    "recorded_at"
            ],
            "leave_requests": [
                    "request_id",
                    "person_id",
                    "leave_type",
                    "start_at",
                    "end_at",
                    "reason",
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "created_at"
            ],
            "zero_production_reports": [
                    "report_id",
                    "person_id",
                    "report_date",
                    "reason",
                    "detail",
                    "created_at"
            ],
            "fuel_station_config": [
                    "config_id",
                    "latitude",
                    "longitude",
                    "radius_m",
                    "fuel_truck_number",
                    "updated_at"
            ],
            "fuel_intakes": [
                    "intake_id",
                    "source",
                    "oil_type",
                    "amount",
                    "remark",
                    "created_at",
                    "client_record_id"
            ],
            "fuel_requests": [
                    "request_id",
                    "applicant_id",
                    "vehicle_id",
                    "equipment_number",
                    "equipment_type",
                    "fuel_truck_number",
                    "latitude",
                    "longitude",
                    "distance_m",
                    "gps_status",
                    "status",
                    "remark",
                    "requested_at",
                    "started_at",
                    "completed_at",
                    "client_record_id"
            ],
            "fuel_records": [
                    "fuel_id",
                    "request_id",
                    "vehicle_id",
                    "vehicle_number",
                    "driver_name",
                    "amount",
                    "photo_url",
                    "confirmation_status",
                    "started_at",
                    "completed_at",
                    "confirmed_at",
                    "rejected_at",
                    "reject_reason",
                    "client_record_id",
                    "created_at"
            ],
            "fuel_stock_adjustments": [
                    "adjustment_id",
                    "theory_stock",
                    "actual_stock",
                    "difference",
                    "reason",
                    "status",
                    "created_at"
            ],
            "finance_costs": [
                    "finance_cost_id",
                    "cost_month",
                    "cost_type",
                    "name",
                    "department",
                    "amount",
                    "voucher_no",
                    "remark",
                    "source_type",
                    "source_id",
                    "status",
                    "created_at"
            ],
            "penalty_records": [
                    "penalty_id",
                    "person_id",
                    "amount",
                    "reason",
                    "source_type",
                    "source_id",
                    "status",
                    "created_at"
            ],
            "reward_records": [
                    "reward_id",
                    "person_id",
                    "employee_no",
                    "person_name",
                    "position",
                    "crew",
                    "vehicle_number",
                    "reward_type",
                    "amount",
                    "description",
                    "work_date",
                    "source",
                    "status",
                    "issued_by",
                    "issued_at",
                    "acknowledged_at",
                    "acknowledged_by",
                    "client_record_id",
                    "extra",
                    "created_at"
            ],
            "overtime_records": [
                    "overtime_id",
                    "person_id",
                    "employee_no",
                    "person_name",
                    "position",
                    "crew",
                    "vehicle_number",
                    "overtime_type",
                    "hours",
                    "amount",
                    "description",
                    "work_date",
                    "source",
                    "status",
                    "issued_by",
                    "issued_at",
                    "acknowledged_at",
                    "acknowledged_by",
                    "client_record_id",
                    "extra",
                    "created_at"
            ],
            "payroll_standards": [
                    "standard_id",
                    "scope",
                    "standard_type",
                    "person_id",
                    "position",
                    "salary_mode",
                    "base_salary",
                    "probation_salary",
                    "regular_salary",
                    "monthly_salary",
                    "performance_unit_price",
                    "effective_date",
                    "remark",
                    "status",
                    "created_at",
                    "updated_at"
            ],
            "payroll_rules": [
                    "rule_id",
                    "updated_at"
            ],
            "payroll_monthly_records": [
                    "payroll_id",
                    "payroll_month",
                    "person_id",
                    "base_amount",
                    "performance_amount",
                    "reward_amount",
                    "deduction_amount",
                    "final_amount",
                    "detail",
                    "status",
                    "created_at",
                    "updated_at"
            ],
            "payroll_monthly_locks": [
                    "payroll_month",
                    "locked",
                    "locked_by",
                    "locked_at",
                    "remark"
            ],
            "payroll_audit_logs": [
                    "audit_id",
                    "payroll_month",
                    "person_id",
                    "action",
                    "actor_person_id",
                    "before_data",
                    "after_data",
                    "created_at"
            ]
    };


    const TABLE_PRIMARY_KEY_MAP = {
        shift_executions: ["shiftId", "shift_id"],
        transport_zones: ["zoneId", "zone_id"],
        equipment: ["equipmentId", "equipment_id"],
        equipment_operational_status: ["equipmentId", "equipment_id"],
        workshop_bays: ["bayId", "bay_id"],
        fuel_intakes: ["intakeId", "intake_id"],
        fuel_stock_adjustments: ["adjustmentId", "adjustment_id"],
        payroll_monthly_locks: ["month", "payrollMonth", "payroll_month"],
        payroll_audit_logs: ["auditId", "audit_id"],
        team_transfer_requests: ["requestId", "request_id"],
        dispatch_tasks: ["taskId", "task_id"],
        temporary_unload_requests: ["requestId", "request_id"],
        temporary_loading_assignments: ["assignmentId", "assignment_id"],
        auxiliary_work_records: ["recordId", "record_id"],
        maintenance_reports: ["reportId", "report_id"],
        fuel_requests: ["requestId", "request_id"],
        fuel_records: ["fuelId", "fuel_id"],
        payroll_standards: ["standardId", "standard_id"],
        equipment_maintenance_settings: ["equipmentId", "equipment_id"],
        attendance_records: ["attendanceId", "attendance_id"],
        leave_requests: ["leaveId", "leave_id", "requestId", "request_id", "id"],
        attendance_geofence_attempts: ["attemptId", "attempt_id"],
        zero_production_reports: ["reportId", "report_id"],
        equipment_checks: ["checkId", "check_id"],
        equipment_meter_readings: [
            "meterRecordId",
            "meter_record_id",
            "readingId",
            "reading_id"
        ],
        penalty_records: ["penaltyId", "penalty_id"],
        reward_records: ["rewardId", "reward_id"],
        overtime_records: ["overtimeId", "overtime_id"],
        payroll_monthly_records: ["payrollId", "payroll_id"],
        material_requests: ["requestId", "request_id"],
        material_holders: ["holderId", "holder_id"],
        material_recycle_records: ["recycleId", "recycle_id"],
        material_scrap_records: ["scrapId", "scrap_id"],
        material_loss_records: [
            "lostId",
            "lost_id",
            "lossId",
            "loss_id"
        ],
        warehouse_transactions: [
            "ledgerId",
            "ledger_id",
            "transactionId",
            "transaction_id",
            "id"
        ],
        maintenance_requests: ["requestId", "request_id", "maintenanceRequestId", "id"],
        maintenance_orders: ["orderId", "order_id", "workOrderId", "id"],
        maintenance_costs: ["costId", "cost_id", "id"],
        maintenance_alerts: ["alertId", "alert_id", "id"],
        equipment_maintenance_records: ["maintenanceRecordId", "maintenance_record_id", "recordId", "id"],
        trip_records: ["id", "tripId", "trip_id"]
    };


    function getPrimaryKey(
        table,
        row
    ) {

        const tableCandidates =
            TABLE_PRIMARY_KEY_MAP[
                table
            ];


        if (
            tableCandidates
        ) {

            for (
                const key
                of tableCandidates
            ) {

                if (
                    row &&
                    row[key] !== undefined &&
                    row[key] !== null &&
                    row[key] !== ""
                ) {

                    return {
                        key,
                        value:
                            row[key]
                    };
                }
            }


            return null;
        }

        const candidates = [
            "id",

            "person_id",
            "personId",

            "vehicle_id",
            "vehicleId",

            "task_id",
            "taskId",

            "trip_id",
            "tripId",

            "request_id",
            "requestId",

            "order_id",
            "orderId",

            "record_id",
            "recordId",

            "check_id",
            "checkId",

            "report_id",
            "reportId",

            "attendance_id",
            "attendanceId",

            "attempt_id",
            "attemptId",

            "leave_id",
            "leaveId",

            "material_id",
            "materialId",

            "holder_id",
            "holderId",

            "recycle_id",
            "recycleId",

            "scrap_id",
            "scrapId",

            "loss_id",
            "lossId",

            "transaction_id",
            "transactionId",

            "ledger_id",
            "ledgerId",

            "maintenance_record_id",
            "maintenanceRecordId",

            "reading_id",
            "readingId",
            "meterRecordId",

            "alert_id",
            "alertId",

            "cost_id",
            "costId",

            "fuel_id",
            "fuelId",

            "standard_id",
            "standardId",

            "finance_cost_id",
            "financeCostId",

            "assignment_id",
            "assignmentId",

            "payroll_id",
            "payrollId",

            "lock_id",
            "lockId",

            "audit_id",
            "auditId",

            "reward_id",
            "rewardId",

            "penalty_id",
            "penaltyId",

            "overtime_id",
            "overtimeId"
        ];


        for (
            const key
            of candidates
        ) {

            if (
                row &&
                row[
                    key
                ]
            ) {

                return {
                    key,
                    value:
                        row[
                            key
                        ]
                };
            }
        }


        return null;
    }


    function queueRead() {

        return safeParse(
            localStorage.getItem(
                CONFIG.queueKey
            ),
            []
        );
    }


    function queueWrite(
        queue
    ) {

        localStorage.setItem(
            CONFIG.queueKey,
            JSON.stringify(
                queue
            )
        );
    }


    function enqueue(
        operation
    ) {

        const queue =
            queueRead();


        const item = {
            queue_id:
                createId(
                    "QUEUE"
                ),

            client_record_id:
                operation
                    .client_record_id ||
                createId(
                    "CLIENTREC"
                ),

            client_id:
                getClientId(),

            table:
                operation.table,

            action:
                operation.action,

            payload:
                clone(
                    operation.payload
                ),

            status:
                "pending",

            attempts:
                0,

            created_at:
                new Date()
                    .toISOString(),

            last_error:
                ""
        };


        queue.push(
            item
        );


        queueWrite(
            queue
        );


        return clone(
            item
        );
    }


    function listPendingQueue() {

        return queueRead()
            .filter(
                item =>
                    item.status !==
                    "synced"
            );
    }


    function clearSyncedQueue() {

        const queue =
            queueRead()
                .filter(
                    item =>
                        item.status !==
                        "synced"
                );


        queueWrite(
            queue
        );


        return queue.length;
    }


    const LocalAdapter = {

        async list(
            table
        ) {

            const value =
                readRaw(
                    table
                );


            return clone(
                value
            );
        },


        async get(
            table,
            id
        ) {

            const rows =
                readRaw(
                    table
                );


            if (
                !Array.isArray(
                    rows
                )
            ) {

                return clone(
                    rows
                );
            }


            return clone(
                rows.find(
                    row => {

                        const pk =
                            getPrimaryKey(
                                table,
                                row
                            );


                        return (
                            pk &&
                            String(
                                pk.value
                            ) ===
                            String(
                                id
                            )
                        );
                    }
                ) ||
                null
            );
        },


        async insert(
            table,
            row,
            options =
                {}
        ) {

            const rows =
                readRaw(
                    table
                );


            if (
                !Array.isArray(
                    rows
                )
            ) {

                throw new Error(
                    "DataService: " +
                    table +
                    " 不是数组型数据，不能 insert"
                );
            }


            const next =
                clone(
                    row
                ) ||
                {};


            if (
                !next.client_record_id
            ) {

                next.client_record_id =
                    createId(
                        "CLIENTREC"
                    );
            }


            if (
                !next.created_at &&
                !next.createdAt
            ) {

                next.created_at =
                    new Date()
                        .toISOString();
            }


            const duplicate =
                rows.find(
                    item =>
                        next.client_record_id &&
                        (
                            item.client_record_id ===
                                next.client_record_id ||
                            item.clientRecordId ===
                                next.client_record_id
                        )
                );


            if (
                duplicate
            ) {

                return clone(
                    duplicate
                );
            }


            rows.push(
                next
            );


            writeRaw(
                table,
                rows
            );


            if (
                options.queue !==
                    false
            ) {

                enqueue({
                    table,
                    action:
                        "insert",

                    client_record_id:
                        next.client_record_id,

                    payload:
                        next
                });
            }


            return clone(
                next
            );
        },


        async upsert(
            table,
            row,
            options =
                {}
        ) {

            const current =
                readRaw(
                    table
                );


            if (
                !Array.isArray(
                    current
                )
            ) {

                writeRaw(
                    table,
                    row
                );


                if (
                    options.queue !==
                        false
                ) {

                    enqueue({
                        table,
                        action:
                            "upsert",

                        payload:
                            row
                    });
                }


                return clone(
                    row
                );
            }


            const next =
                clone(
                    row
                ) ||
                {};


            const pk =
                getPrimaryKey(
                    table,
                    next
                );


            if (
                !next.client_record_id
            ) {

                next.client_record_id =
                    createId(
                        "CLIENTREC"
                    );
            }


            let index =
                -1;


            if (
                pk
            ) {

                index =
                    current.findIndex(
                        item => {

                            const itemPk =
                                getPrimaryKey(
                                    table,
                                    item
                                );


                            return (
                                itemPk &&
                                String(
                                    itemPk.value
                                ) ===
                                String(
                                    pk.value
                                )
                            );
                        }
                    );
            }


            if (
                index >=
                    0
            ) {

                current[
                    index
                ] = {
                    ...current[
                        index
                    ],
                    ...next
                };

            } else {

                current.push(
                    next
                );
            }


            writeRaw(
                table,
                current
            );


            if (
                options.queue !==
                    false
            ) {

                enqueue({
                    table,
                    action:
                        "upsert",

                    client_record_id:
                        next.client_record_id,

                    payload:
                        next
                });
            }


            return clone(
                next
            );
        },


        async update(
            table,
            id,
            patch,
            options =
                {}
        ) {

            const rows =
                readRaw(
                    table
                );


            if (
                !Array.isArray(
                    rows
                )
            ) {

                throw new Error(
                    "DataService: " +
                    table +
                    " 不是数组型数据，不能 update"
                );
            }


            const index =
                rows.findIndex(
                    item => {

                        const pk =
                            getPrimaryKey(
                                table,
                                item
                            );


                        return (
                            pk &&
                            String(
                                pk.value
                            ) ===
                            String(
                                id
                            )
                        );
                    }
                );


            if (
                index <
                    0
            ) {

                return null;
            }


            rows[
                index
            ] = {
                ...rows[
                    index
                ],
                ...clone(
                    patch
                ),

                updated_at:
                    new Date()
                        .toISOString()
            };


            writeRaw(
                table,
                rows
            );


            if (
                options.queue !==
                    false
            ) {

                enqueue({
                    table,
                    action:
                        "update",

                    payload: {
                        id,
                        patch:
                            clone(
                                patch
                            )
                    }
                });
            }


            return clone(
                rows[
                    index
                ]
            );
        },


        async softDelete(
            table,
            id,
            options =
                {}
        ) {

            return this.update(
                table,
                id,
                {
                    status:
                        "disabled",

                    deleted_at:
                        new Date()
                            .toISOString()
                },
                options
            );
        },


        async setSingleton(
            table,
            value,
            options =
                {}
        ) {

            writeRaw(
                table,
                value
            );


            if (
                options.queue !==
                    false
            ) {

                enqueue({
                    table,
                    action:
                        "upsert",

                    payload:
                        value
                });
            }


            return clone(
                value
            );
        }
    };


    function camelToSnake(value) {

        return String(value).replace(/[A-Z]/g, letter => "_" + letter.toLowerCase());
    }


    function snakeToCamel(value) {

        return String(value).replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
    }


    function toRemotePayload(
        table,
        payload
    ) {

        const value = clone(payload);

        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return value;
        }

        const columns = REMOTE_SCHEMA_COLUMNS[table];

        if (!columns) {
            throw new Error("Supabase schema 未定义数据表: " + table);
        }

        const allowed = new Set(columns);
        const supportsExtra = allowed.has("extra");
        const result = {};
        const extra = {};

        if (supportsExtra && value.extra && typeof value.extra === "object" && !Array.isArray(value.extra)) {
            Object.assign(extra, value.extra);
        }

        for (const [key, fieldValue] of Object.entries(value)) {
            if (key === "extra") {
                continue;
            }

            const column = allowed.has(key) ? key : camelToSnake(key);

            if (allowed.has(column)) {
                if (Object.prototype.hasOwnProperty.call(result, column) && result[column] !== fieldValue) {
                    throw new Error("Supabase 字段映射冲突: " + table + "." + column);
                }

                result[column] = fieldValue;
                continue;
            }

            if (supportsExtra) {
                extra[key] = fieldValue;
                continue;
            }

            throw new Error("Supabase schema 不支持字段: " + table + "." + key);
        }

        if (supportsExtra && Object.keys(extra).length) {
            result.extra = extra;
        }

        if (table === "general_manager_business_settings" && result.comprehensive_unit_price !== undefined) {
            result.comprehensive_unit_price = Number(result.comprehensive_unit_price || 0);
        }

        if (table === "production_volume_settings" && result.default_volume_per_trip !== undefined) {
            result.default_volume_per_trip = Number(result.default_volume_per_trip || 0);
        }

        return result;
    }


    function fromRemotePayload(
        table,
        payload
    ) {

        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return payload;
        }

        const columns = REMOTE_SCHEMA_COLUMNS[table];

        if (!columns) {
            throw new Error("Supabase schema 未定义数据表: " + table);
        }

        const allowed = new Set(columns);
        const result = {};
        const extra = payload.extra && typeof payload.extra === "object" && !Array.isArray(payload.extra)
            ? clone(payload.extra)
            : {};

        for (const [key, fieldValue] of Object.entries(payload)) {
            if (key === "extra") {
                continue;
            }

            if (!allowed.has(key)) {
                throw new Error("Supabase 返回了 schema 未声明字段: " + table + "." + key);
            }

            result[snakeToCamel(key)] = clone(fieldValue);
        }

        // Real columns win over same-named JSONB keys to avoid shadowing authoritative values.
        for (const [key, fieldValue] of Object.entries(result)) {
            extra[key] = fieldValue;
        }

        return extra;
    }


    const SupabaseAdapter = {

        isConfigured() {

            return Boolean(
                CONFIG.supabaseUrl &&
                CONFIG.supabaseAnonKey
            );
        },


        async request(
            table,
            options =
                {}
        ) {

            if (
                !this.isConfigured()
            ) {

                throw new Error(
                    "Supabase 尚未配置"
                );
            }


            const url =
                CONFIG.supabaseUrl
                    .replace(
                        /\/$/,
                        ""
                    ) +
                "/rest/v1/" +
                encodeURIComponent(
                    table
                ) +
                (
                    options.query
                        ? "?" +
                          options.query
                        : ""
                );


            const authSession =
                readAuthSession();


            const headers = {
                apikey:
                    CONFIG.supabaseAnonKey,

                Authorization:
                    "Bearer " +
                    (
                        authSession?.access_token ||
                        CONFIG.supabaseAnonKey
                    ),

                "Content-Type":
                    "application/json",

                Prefer:
                    options.prefer ||
                    "return=representation"
            };


            const response =
                await fetch(
                    url,
                    {
                        method:
                            options.method ||
                            "GET",

                        headers,

                        body:
                            options.body ===
                                undefined
                                ? undefined
                                : JSON.stringify(
                                      options.body
                                  )
                    }
                );


            if (
                !response.ok
            ) {

                const text =
                    await response.text();


                throw new Error(
                    "Supabase请求失败 " +
                    response.status +
                    ": " +
                    text
                );
            }


            const responseText =
                await response.text();


            return responseText
                ? safeParse(
                      responseText,
                      responseText
                  )
                : null;
        },


        async list(
            table
        ) {

            const rows = await this.request(
                table,
                {
                    query:
                        "select=*"
                }
            );

            return Array.isArray(rows)
                ? rows.map(row => fromRemotePayload(table, row))
                : rows;
        },


        async insert(
            table,
            row
        ) {

            const response = await this.request(
                table,
                {
                    method:
                        "POST",

                    body:
                        toRemotePayload(
                            table,
                            row
                        )
                }
            );

            return Array.isArray(response)
                ? response.map(item => fromRemotePayload(table, item))
                : response;
        },


        async upsert(
            table,
            row
        ) {

            const response = await this.request(
                table,
                {
                    method:
                        "POST",

                    prefer:
                        "resolution=merge-duplicates,return=representation",

                    body:
                        toRemotePayload(
                            table,
                            row
                        )
                }
            );

            return Array.isArray(response)
                ? response.map(item => fromRemotePayload(table, item))
                : response;
        }
    };


    async function syncPendingQueue() {

        if (
            CONFIG.mode !==
                "supabase"
        ) {

            return {
                ok:
                    true,

                skipped:
                    true,

                reason:
                    "当前仍为 local 模式",

                pending:
                    listPendingQueue()
                        .length
            };
        }


        if (
            !SupabaseAdapter.isConfigured()
        ) {

            throw new Error(
                "Supabase尚未配置，不能同步"
            );
        }


        const queue =
            queueRead();


        let success =
            0;


        let failed =
            0;


        for (
            const item
            of queue
        ) {

            if (
                item.status ===
                    "synced"
            ) {

                continue;
            }


            try {

                item.attempts =
                    Number(
                        item.attempts ||
                        0
                    ) +
                    1;


                const payload =
                    clone(
                        item.payload
                    );


                if (
                    CLIENT_RECORD_ID_TABLES.has(
                        item.table
                    ) &&
                    payload &&
                    typeof payload ===
                        "object" &&
                    !Array.isArray(
                        payload
                    ) &&
                    !payload.client_record_id
                ) {

                    payload.client_record_id =
                        item.client_record_id;
                }


                if (
                    item.action ===
                        "insert"
                ) {

                    await SupabaseAdapter.insert(
                        item.table,
                        payload
                    );

                } else if (
                    item.action ===
                        "upsert"
                ) {

                    await SupabaseAdapter.upsert(
                        item.table,
                        payload
                    );

                } else {

                    /*
                     * update / soft-delete 在真正切换页面前
                     * 再补精确过滤条件，当前先保留队列结构。
                     */
                    throw new Error(
                        "当前V1同步器暂不自动提交 action=" +
                        item.action
                    );
                }


                item.status =
                    "synced";


                item.synced_at =
                    new Date()
                        .toISOString();


                item.last_error =
                    "";


                success +=
                    1;

            } catch (
                error
            ) {

                item.status =
                    "failed";


                item.last_error =
                    error?.message ||
                    String(
                        error
                    );


                failed +=
                    1;
            }
        }


        queueWrite(
            queue
        );


        return {
            ok:
                failed ===
                0,

            success,
            failed,
            pending:
                listPendingQueue()
                    .length
        };
    }


    async function testAuthenticatedManagementAccess() {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            return {
                ok:
                    false,

                message:
                    "Supabase 尚未配置"
            };
        }


        const auth =
            getAuthInfo();


        if (
            !auth.signedIn
        ) {

            return {
                ok:
                    false,

                message:
                    "当前尚未登录 Supabase Auth"
            };
        }


        const testId =
            "TEST-AUTH-MANAGER-CONFIG";


        const now =
            new Date()
                .toISOString();


        const gmInput = {
            singletonId:
                testId,

            reportMonth:
                "2099-11",

            comprehensiveUnitPrice:
                20.66,

            updatedAt:
                now
        };


        const volumeInput = {
            singletonId:
                testId,

            defaultVolumePerTrip:
                39.75,

            vehicleModels: {
                "TEST-AUTH-MODEL":
                    42.5
            },

            updatedAt:
                now
        };


        try {

            await SupabaseAdapter.upsert(
                "general_manager_business_settings",
                gmInput
            );


            await SupabaseAdapter.upsert(
                "production_volume_settings",
                volumeInput
            );


            const gmRows =
                await SupabaseAdapter.request(
                    "general_manager_business_settings",
                    {
                        query:
                            "select=singleton_id,report_month,comprehensive_unit_price&singleton_id=eq." +
                            encodeURIComponent(
                                testId
                            ) +
                            "&limit=1"
                    }
                );


            const volumeRows =
                await SupabaseAdapter.request(
                    "production_volume_settings",
                    {
                        query:
                            "select=singleton_id,default_volume_per_trip,vehicle_models&singleton_id=eq." +
                            encodeURIComponent(
                                testId
                            ) +
                            "&limit=1"
                    }
                );


            const gmOk =
                Array.isArray(
                    gmRows
                ) &&
                gmRows.length ===
                    1 &&
                gmRows[
                    0
                ]?.singleton_id ===
                    testId;


            const volumeOk =
                Array.isArray(
                    volumeRows
                ) &&
                volumeRows.length ===
                    1 &&
                volumeRows[
                    0
                ]?.singleton_id ===
                    testId;


            await SupabaseAdapter.request(
                "general_manager_business_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "singleton_id=eq." +
                        encodeURIComponent(
                            testId
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            await SupabaseAdapter.request(
                "production_volume_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "singleton_id=eq." +
                        encodeURIComponent(
                            testId
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            if (
                !gmOk ||
                !volumeOk
            ) {

                return {
                    ok:
                        false,

                    message:
                        "authenticated 管理员写入成功，但回读校验未全部通过"
                };
            }


            return {
                ok:
                    true,

                message:
                    "authenticated + 管理员身份通过正式配置 RLS，写入、回读、清理全部通过",

                testId,

                userId:
                    auth.userId,

                email:
                    auth.email
            };

        } catch (
            error
        ) {

            for (
                const table
                of [
                    "general_manager_business_settings",
                    "production_volume_settings"
                ]
            ) {

                try {

                    await SupabaseAdapter.request(
                        table,
                        {
                            method:
                                "DELETE",

                            query:
                                "singleton_id=eq." +
                                encodeURIComponent(
                                    testId
                                ),

                            prefer:
                                "return=minimal"
                        }
                    );

                } catch (
                    cleanupError
                ) {}
            }


            return {
                ok:
                    false,

                message:
                    error?.message ||
                    String(
                        error
                    )
            };
        }
    }


    async function testBusinessConfigMappings() {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            return {
                ok:
                    false,

                message:
                    "Supabase 尚未配置"
            };
        }


        const testId =
            "TEST-DATASERVICE-CONFIG";


        const now =
            new Date()
                .toISOString();


        const gmInput = {
            singletonId:
                testId,

            reportMonth:
                "2099-12",

            comprehensiveUnitPrice:
                19.88,

            updatedAt:
                now
        };


        const volumeInput = {
            singletonId:
                testId,

            defaultVolumePerTrip:
                38.5,

            vehicleModels: {
                "TEST-MODEL":
                    41.25
            },

            updatedAt:
                now
        };


        try {

            await SupabaseAdapter.upsert(
                "general_manager_business_settings",
                gmInput
            );


            await SupabaseAdapter.upsert(
                "production_volume_settings",
                volumeInput
            );


            const gmRows =
                await SupabaseAdapter.request(
                    "general_manager_business_settings",
                    {
                        query:
                            "select=singleton_id,report_month,comprehensive_unit_price,updated_at&singleton_id=eq." +
                            encodeURIComponent(
                                testId
                            ) +
                            "&limit=1"
                    }
                );


            const volumeRows =
                await SupabaseAdapter.request(
                    "production_volume_settings",
                    {
                        query:
                            "select=singleton_id,default_volume_per_trip,vehicle_models,updated_at&singleton_id=eq." +
                            encodeURIComponent(
                                testId
                            ) +
                            "&limit=1"
                    }
                );


            const gmOk =
                Array.isArray(
                    gmRows
                ) &&
                gmRows.length ===
                    1 &&
                gmRows[
                    0
                ]?.singleton_id ===
                    testId &&
                gmRows[
                    0
                ]?.report_month ===
                    "2099-12" &&
                Number(
                    gmRows[
                        0
                    ]?.comprehensive_unit_price
                ) ===
                    19.88;


            const volumeOk =
                Array.isArray(
                    volumeRows
                ) &&
                volumeRows.length ===
                    1 &&
                volumeRows[
                    0
                ]?.singleton_id ===
                    testId &&
                Number(
                    volumeRows[
                        0
                    ]?.default_volume_per_trip
                ) ===
                    38.5 &&
                Number(
                    volumeRows[
                        0
                    ]?.vehicle_models?.[
                        "TEST-MODEL"
                    ]
                ) ===
                    41.25;


            await SupabaseAdapter.request(
                "general_manager_business_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "singleton_id=eq." +
                        encodeURIComponent(
                            testId
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            await SupabaseAdapter.request(
                "production_volume_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "singleton_id=eq." +
                        encodeURIComponent(
                            testId
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            if (
                !gmOk ||
                !volumeOk
            ) {

                return {
                    ok:
                        false,

                    message:
                        "配置字段映射写入成功，但回读校验未全部通过",

                    generalManager:
                        gmOk,

                    productionVolume:
                        volumeOk
                };
            }


            return {
                ok:
                    true,

                message:
                    "两张正式配置表字段映射、写入、回读、清理全部通过",

                testId
            };

        } catch (
            error
        ) {

            for (
                const table
                of [
                    "general_manager_business_settings",
                    "production_volume_settings"
                ]
            ) {

                try {

                    await SupabaseAdapter.request(
                        table,
                        {
                            method:
                                "DELETE",

                            query:
                                "singleton_id=eq." +
                                encodeURIComponent(
                                    testId
                                ),

                            prefer:
                                "return=minimal"
                        }
                    );

                } catch (
                    cleanupError
                ) {}
            }


            return {
                ok:
                    false,

                message:
                    error?.message ||
                    String(
                        error
                    )
            };
        }
    }


    async function testPendingQueueRoundTrip() {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            return {
                ok:
                    false,

                message:
                    "Supabase 尚未配置"
            };
        }


        const existingPending =
            listPendingQueue();


        if (
            existingPending.length >
                0
        ) {

            return {
                ok:
                    false,

                message:
                    "当前存在 " +
                    existingPending.length +
                    " 条真实待同步队列，为避免误同步，本测试已停止"
            };
        }


        const settingKey =
            "TEST-DATASERVICE-CONNECTION";


        const testedAt =
            new Date()
                .toISOString();


        const originalMode =
            CONFIG.mode;


        const queue =
            queueRead();


        const testItem = {
            queue_id:
                createId(
                    "QUEUE-TEST"
                ),

            client_record_id:
                createId(
                    "CLIENTREC-TEST"
                ),

            client_id:
                getClientId(),

            table:
                "system_settings",

            action:
                "upsert",

            payload: {
                setting_key:
                    settingKey,

                setting_value: {
                    source:
                        "pending-queue-test",

                    marker:
                        "TEST-ONLY",

                    tested_at:
                        testedAt
                },

                updated_by:
                    "TEST-DATASERVICE-QUEUE",

                updated_at:
                    testedAt
            },

            status:
                "pending",

            attempts:
                0,

            created_at:
                testedAt,

            last_error:
                ""
        };


        queue.push(
            testItem
        );


        queueWrite(
            queue
        );


        try {

            CONFIG.mode =
                "supabase";


            const syncResult =
                await syncPendingQueue();


            const readBack =
                await SupabaseAdapter.request(
                    "system_settings",
                    {
                        query:
                            "select=setting_key,setting_value,updated_by,updated_at&setting_key=eq." +
                            encodeURIComponent(
                                settingKey
                            ) +
                            "&limit=1"
                    }
                );


            const matched =
                syncResult.ok &&
                Array.isArray(
                    readBack
                ) &&
                readBack.length ===
                    1 &&
                readBack[
                    0
                ]?.setting_key ===
                    settingKey &&
                readBack[
                    0
                ]?.setting_value?.source ===
                    "pending-queue-test";


            await SupabaseAdapter.request(
                "system_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "setting_key=eq." +
                        encodeURIComponent(
                            settingKey
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            const cleanedQueue =
                queueRead()
                    .filter(
                        item =>
                            item.queue_id !==
                            testItem.queue_id
                    );


            queueWrite(
                cleanedQueue
            );


            if (
                !matched
            ) {

                return {
                    ok:
                        false,

                    message:
                        "TEST 队列已执行，但远端回读校验未通过",

                    syncResult
                };
            }


            return {
                ok:
                    true,

                message:
                    "pending queue → Supabase 同步、回读、清理全部通过",

                settingKey,

                syncResult
            };

        } catch (
            error
        ) {

            try {

                await SupabaseAdapter.request(
                    "system_settings",
                    {
                        method:
                            "DELETE",

                        query:
                            "setting_key=eq." +
                            encodeURIComponent(
                                settingKey
                            ),

                        prefer:
                            "return=minimal"
                    }
                );

            } catch (
                cleanupError
            ) {}


            const cleanedQueue =
                queueRead()
                    .filter(
                        item =>
                            item.queue_id !==
                            testItem.queue_id
                    );


            queueWrite(
                cleanedQueue
            );


            return {
                ok:
                    false,

                message:
                    error?.message ||
                    String(
                        error
                    )
            };

        } finally {

            CONFIG.mode =
                originalMode;
        }
    }


    function setMode(
        mode
    ) {

        if (
            ![
                "local",
                "supabase"
            ].includes(
                mode
            )
        ) {

            throw new Error(
                "DataService: mode 必须是 local 或 supabase"
            );
        }


        CONFIG.mode =
            mode;


        return CONFIG.mode;
    }


    function configureSupabase({
        url,
        anonKey,
        persist =
            true
    }) {

        CONFIG.supabaseUrl =
            String(
                url ||
                ""
            )
                .trim()
                .replace(
                    /\/$/,
                    ""
                );


        CONFIG.supabaseAnonKey =
            String(
                anonKey ||
                ""
            )
                .trim();


        if (
            persist
        ) {

            saveSupabaseConfig();
        }


        return {
            configured:
                SupabaseAdapter.isConfigured(),

            url:
                CONFIG.supabaseUrl
        };
    }


    function clearSupabaseConfig() {

        CONFIG.supabaseUrl =
            "";


        CONFIG.supabaseAnonKey =
            "";


        localStorage.removeItem(
            CONFIG.supabaseConfigKey
        );


        CONFIG.mode =
            "local";


        return {
            configured:
                false,

            mode:
                CONFIG.mode
        };
    }


    function getConnectionInfo() {

        return {
            mode:
                CONFIG.mode,

            configured:
                SupabaseAdapter.isConfigured(),

            url:
                CONFIG.supabaseUrl,

            anonKeyPresent:
                Boolean(
                    CONFIG.supabaseAnonKey
                ),

            pending:
                listPendingQueue()
                    .length
        };
    }


    async function testConnection() {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            return {
                ok:
                    false,

                configured:
                    false,

                message:
                    "Supabase 尚未配置"
            };
        }


        try {

            const result =
                await SupabaseAdapter.request(
                    "system_settings",
                    {
                        query:
                            "select=setting_key&limit=1"
                    }
                );


            return {
                ok:
                    true,

                configured:
                    true,

                message:
                    "Supabase REST 连接正常，system_settings 表可访问",

                sample:
                    result
            };

        } catch (
            error
        ) {

            return {
                ok:
                    false,

                configured:
                    true,

                message:
                    error?.message ||
                    String(
                        error
                    )
            };
        }
    }


    async function testRemoteRoundTrip() {

        if (
            !SupabaseAdapter.isConfigured()
        ) {

            return {
                ok:
                    false,

                message:
                    "Supabase 尚未配置"
            };
        }


        const settingKey =
            "TEST-DATASERVICE-CONNECTION";


        const testedAt =
            new Date()
                .toISOString();


        const row = {
            setting_key:
                settingKey,

            setting_value: {
                source:
                    "data-service-check",

                marker:
                    "TEST-ONLY",

                tested_at:
                    testedAt
            },

            updated_by:
                "TEST-DATASERVICE",

            updated_at:
                testedAt
        };


        try {

            await SupabaseAdapter.upsert(
                "system_settings",
                row
            );


            const readBack =
                await SupabaseAdapter.request(
                    "system_settings",
                    {
                        query:
                            "select=setting_key,setting_value,updated_by,updated_at&setting_key=eq." +
                            encodeURIComponent(
                                settingKey
                            ) +
                            "&limit=1"
                    }
                );


            const matched =
                Array.isArray(
                    readBack
                ) &&
                readBack.length ===
                    1 &&
                readBack[
                    0
                ]?.setting_key ===
                    settingKey &&
                readBack[
                    0
                ]?.setting_value?.marker ===
                    "TEST-ONLY";


            await SupabaseAdapter.request(
                "system_settings",
                {
                    method:
                        "DELETE",

                    query:
                        "setting_key=eq." +
                        encodeURIComponent(
                            settingKey
                        ),

                    prefer:
                        "return=minimal"
                }
            );


            if (
                !matched
            ) {

                return {
                    ok:
                        false,

                    message:
                        "TEST 写入成功，但回读校验未通过"
                };
            }


            return {
                ok:
                    true,

                message:
                    "TEST 单条写入、回读、清理全部通过",

                settingKey,

                readBack:
                    readBack[
                        0
                    ]
            };

        } catch (
            error
        ) {

            try {

                await SupabaseAdapter.request(
                    "system_settings",
                    {
                        method:
                            "DELETE",

                        query:
                            "setting_key=eq." +
                            encodeURIComponent(
                                settingKey
                            ),

                        prefer:
                            "return=minimal"
                    }
                );

            } catch (
                cleanupError
            ) {}


            return {
                ok:
                    false,

                message:
                    error?.message ||
                    String(
                        error
                    )
            };
        }
    }


    async function list(
        table
    ) {

        if (
            CONFIG.mode ===
                "supabase"
        ) {

            return await SupabaseAdapter.list(
                table
            );
        }


        return await LocalAdapter.list(
            table
        );
    }


    async function insert(
        table,
        row,
        options
    ) {

        /*
         * 当前V1采用 local-first：
         * 页面先安全写本地并进入同步队列。
         * 真正切换到 Supabase 时再逐页面启用 sync。
         */
        return await LocalAdapter.insert(
            table,
            row,
            options
        );
    }


    async function upsert(
        table,
        row,
        options
    ) {

        return await LocalAdapter.upsert(
            table,
            row,
            options
        );
    }


    async function update(
        table,
        id,
        patch,
        options
    ) {

        return await LocalAdapter.update(
            table,
            id,
            patch,
            options
        );
    }


    async function softDelete(
        table,
        id,
        options
    ) {

        return await LocalAdapter.softDelete(
            table,
            id,
            options
        );
    }


    const DataService = {
        version:
            "1.0.0",

        config:
            CONFIG,

        tableKeyMap:
            clone(
                TABLE_KEY_MAP
            ),

        schemaColumns:
            clone(
                REMOTE_SCHEMA_COLUMNS
            ),

        setMode,

        configureSupabase,

        clearSupabaseConfig,

        getConnectionInfo,

        testConnection,

        testRemoteRoundTrip,

        testPendingQueueRoundTrip,

        testBusinessConfigMappings,

        testAuthenticatedManagementAccess,

        getAuthInfo,

        signInWithPassword,

        signOutAuth,

        list,

        get:
            LocalAdapter.get.bind(
                LocalAdapter
            ),

        insert,

        upsert,

        update,

        softDelete,

        setSingleton:
            LocalAdapter.setSingleton.bind(
                LocalAdapter
            ),

        getClientId,

        createId,

        getPendingQueue:
            listPendingQueue,

        clearSyncedQueue,

        syncPendingQueue,

        local:
            LocalAdapter,

        supabase:
            SupabaseAdapter
    };


    loadSavedSupabaseConfig();


        global.MineDataService =
        DataService;


    log(
        "ready",
        DataService.version,
        CONFIG.mode
    );


})(
    window
);

