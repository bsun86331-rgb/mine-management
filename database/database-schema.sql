-- mine-management PostgreSQL / Supabase schema V1
-- 目标：先建立稳定数据模型，不立即切换现有生产页面。
-- 建议在 Supabase SQL Editor 执行前先创建独立测试项目。

create extension if not exists pgcrypto;

-- =========================================================
-- 通用
-- =========================================================

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  action text not null,
  actor_person_id text,
  before_data jsonb,
  after_data jsonb,
  client_record_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_audit_logs_client_record_id
on audit_logs(client_record_id)
where client_record_id is not null;

create table if not exists system_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);


-- 总经理经营参数：单例配置
create table if not exists general_manager_business_settings (
  singleton_id text primary key default 'default',
  report_month text,
  comprehensive_unit_price numeric not null default 0,
  updated_at timestamptz not null default now()
);

-- 生产方量参数：单例配置
create table if not exists production_volume_settings (
  singleton_id text primary key default 'default',
  default_volume_per_trip numeric not null default 0,
  vehicle_models jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 人员 / 车辆
-- =========================================================

create table if not exists personnel (
  person_id text primary key,
  auth_user_id uuid unique references auth.users(id),
  employee_no text,
  name text not null,
  position text not null,
  department text,
  team text,
  phone text,
  status text not null default 'active',
  approval_status text default 'approved',
  personnel_status text,
  enabled boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_personnel_employee_no
on personnel(employee_no)
where employee_no is not null and employee_no <> '';

create table if not exists vehicles (
  vehicle_id text primary key,
  vehicle_number text not null unique,
  vehicle_type text,
  model text,
  team text,
  status text not null default 'active',
  current_driver_id text references personnel(person_id),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_transfer_requests (
  request_id text primary key,
  person_id text references personnel(person_id),
  from_team text,
  to_team text,
  reason text,
  status text not null default 'pending',
  reviewed_by text references personnel(person_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_change_requests (
  request_id text primary key,
  driver_id text references personnel(person_id),
  from_vehicle_id text references vehicles(vehicle_id),
  to_vehicle_id text references vehicles(vehicle_id),
  reason text,
  status text not null default 'pending',
  reviewed_by text references personnel(person_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 调度 / 班次 / 运输 / GPS
-- =========================================================

create table if not exists transport_zones (
  zone_id text primary key,
  zone_name text not null,
  zone_type text not null,
  latitude double precision,
  longitude double precision,
  radius_m numeric,
  geometry_data jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dispatch_tasks (
  task_id text primary key,
  task_type text not null default 'transport',
  title text,
  driver_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  load_zone_id text references transport_zones(zone_id),
  unload_zone_id text references transport_zones(zone_id),
  status text not null default 'pending',
  priority integer not null default 0,
  published_by text references personnel(person_id),
  published_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  client_record_id text unique,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shift_executions (
  shift_id text primary key,
  shift_date date not null,
  shift_name text,
  driver_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  task_id text references dispatch_tasks(task_id),
  status text not null default 'active',
  started_at timestamptz,
  ended_at timestamptz,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists trip_records (
  trip_id text primary key,
  task_id text references dispatch_tasks(task_id),
  shift_id text references shift_executions(shift_id),
  driver_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  load_zone_id text references transport_zones(zone_id),
  unload_zone_id text references transport_zones(zone_id),
  loaded_at timestamptz,
  unloaded_at timestamptz,
  completed_at timestamptz,
  status text not null default 'completed',
  payload_amount numeric,
  client_record_id text unique,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_records_driver_time
on trip_records(driver_id, completed_at desc);

create index if not exists idx_trip_records_vehicle_time
on trip_records(vehicle_id, completed_at desc);

create table if not exists gps_events (
  id bigserial primary key,
  person_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  task_id text references dispatch_tasks(task_id),
  event_type text not null,
  latitude double precision,
  longitude double precision,
  accuracy_m numeric,
  speed_kph numeric,
  zone_id text references transport_zones(zone_id),
  client_record_id text unique,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_gps_events_vehicle_time
on gps_events(vehicle_id, recorded_at desc);

create table if not exists temporary_unload_requests (
  request_id text primary key,
  task_id text references dispatch_tasks(task_id),
  driver_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  requested_zone_text text,
  latitude double precision,
  longitude double precision,
  reason text,
  status text not null default 'pending',
  reviewed_by text references personnel(person_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists temporary_loading_assignments (
  assignment_id text primary key,
  driver_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  task_id text references dispatch_tasks(task_id),
  loading_source text,
  status text not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists auxiliary_work_records (
  record_id text primary key,
  person_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  work_type text,
  work_area text,
  quantity numeric,
  unit text,
  status text not null default 'completed',
  started_at timestamptz,
  completed_at timestamptz,
  remark text,
  client_record_id text unique,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 设备检查 / 维修
-- =========================================================

create table if not exists equipment (
  equipment_id text primary key,
  equipment_number text not null unique,
  equipment_type text,
  model text,
  status text not null default 'active',
  current_meter numeric,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists equipment_checks (
  check_id text primary key,
  equipment_id text references equipment(equipment_id),
  checker_person_id text references personnel(person_id),
  result text not null,
  abnormal_items jsonb not null default '[]'::jsonb,
  remark text,
  checked_at timestamptz not null default now(),
  client_record_id text unique
);

create table if not exists equipment_operational_status (
  equipment_id text primary key references equipment(equipment_id),
  operational_status text not null,
  locked boolean not null default false,
  lock_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists equipment_meter_readings (
  reading_id text primary key,
  equipment_id text references equipment(equipment_id),
  meter_type text not null,
  reading_value numeric not null,
  recorded_by text references personnel(person_id),
  recorded_at timestamptz not null default now(),
  client_record_id text unique
);

create table if not exists equipment_maintenance_settings (
  equipment_id text primary key references equipment(equipment_id),
  interval_hours numeric,
  interval_km numeric,
  warning_before_hours numeric,
  warning_before_km numeric,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists equipment_maintenance_records (
  maintenance_record_id text primary key,
  equipment_id text references equipment(equipment_id),
  maintenance_type text,
  meter_value numeric,
  description text,
  performed_by text references personnel(person_id),
  performed_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_requests (
  request_id text primary key,
  equipment_id text references equipment(equipment_id),
  requested_by text references personnel(person_id),
  source_check_id text references equipment_checks(check_id),
  description text,
  severity text,
  status text not null default 'pending',
  approved_by text references personnel(person_id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists workshop_bays (
  bay_id text primary key,
  bay_name text not null,
  status text not null default 'available',
  current_order_id text,
  updated_at timestamptz not null default now()
);

create table if not exists maintenance_orders (
  order_id text primary key,
  request_id text references maintenance_requests(request_id),
  equipment_id text references equipment(equipment_id),
  bay_id text references workshop_bays(bay_id),
  assigned_worker_id text references personnel(person_id),
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  accepted_at timestamptz,
  result text,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_reports (
  report_id text primary key,
  order_id text references maintenance_orders(order_id),
  equipment_id text references equipment(equipment_id),
  worker_id text references personnel(person_id),
  summary text,
  details jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists maintenance_alerts (
  alert_id text primary key,
  equipment_id text references equipment(equipment_id),
  alert_type text not null,
  message text,
  status text not null default 'open',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists maintenance_costs (
  cost_id text primary key,
  order_id text references maintenance_orders(order_id),
  equipment_id text references equipment(equipment_id),
  cost_type text,
  amount numeric not null default 0,
  remark text,
  incurred_at timestamptz not null default now()
);

-- =========================================================
-- 库房 / 物资
-- =========================================================

create table if not exists warehouse_materials (
  material_id text primary key,
  code text,
  name text not null,
  category text,
  spec text,
  unit text,
  material_type text,
  available_qty numeric not null default 0,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_warehouse_materials_code
on warehouse_materials(code)
where code is not null and code <> '';

create table if not exists material_requests (
  request_id text primary key,
  person_id text references personnel(person_id),
  material_id text references warehouse_materials(material_id),
  request_quantity numeric not null,
  request_type text not null default 'normal',
  purpose text,
  remark text,
  status text not null default 'pending',
  actual_quantity numeric,
  reviewed_by text references personnel(person_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists warehouse_transactions (
  transaction_id text primary key,
  material_id text references warehouse_materials(material_id),
  transaction_type text not null,
  quantity numeric not null,
  request_id text references material_requests(request_id),
  person_id text references personnel(person_id),
  reference_type text,
  reference_id text,
  remark text,
  client_record_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists material_holders (
  holder_id text primary key,
  material_id text references warehouse_materials(material_id),
  person_id text references personnel(person_id),
  quantity numeric not null default 0,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  status text not null default 'holding'
);

create table if not exists material_loss_records (
  loss_id text primary key,
  material_id text references warehouse_materials(material_id),
  person_id text references personnel(person_id),
  quantity numeric not null,
  reason text,
  compensation_amount numeric not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists material_recycle_records (
  recycle_id text primary key,
  material_id text references warehouse_materials(material_id),
  person_id text references personnel(person_id),
  quantity numeric not null,
  condition_text text,
  created_at timestamptz not null default now()
);

create table if not exists material_scrap_records (
  scrap_id text primary key,
  material_id text references warehouse_materials(material_id),
  quantity numeric not null,
  reason text,
  approved_by text references personnel(person_id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- 考勤 / 请假
-- =========================================================

create table if not exists attendance_geofence_config (
  config_id text primary key default 'default',
  enabled boolean not null default true,
  name text,
  latitude double precision,
  longitude double precision,
  radius_m numeric,
  max_accuracy_m numeric,
  updated_by text references personnel(person_id),
  updated_at timestamptz not null default now()
);

create table if not exists attendance_records (
  attendance_id text primary key,
  person_id text references personnel(person_id),
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  attendance_status text not null default 'present',
  check_in_snapshot jsonb,
  check_out_snapshot jsonb,
  client_record_id text unique,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_attendance_person_date
on attendance_records(person_id, attendance_date);

create table if not exists attendance_geofence_attempts (
  attempt_id bigserial primary key,
  person_id text references personnel(person_id),
  action_type text not null,
  valid boolean not null,
  latitude double precision,
  longitude double precision,
  accuracy_m numeric,
  distance_m numeric,
  recorded_at timestamptz not null default now()
);

create table if not exists leave_requests (
  request_id text primary key,
  person_id text references personnel(person_id),
  leave_type text,
  start_at timestamptz,
  end_at timestamptz,
  reason text,
  status text not null default 'pending',
  reviewed_by text references personnel(person_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists zero_production_reports (
  report_id text primary key,
  person_id text references personnel(person_id),
  report_date date not null,
  reason text,
  detail text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 油料 / 加油
-- =========================================================

create table if not exists fuel_station_config (
  config_id text primary key default 'default',
  latitude double precision,
  longitude double precision,
  radius_m numeric,
  fuel_truck_number text,
  updated_at timestamptz not null default now()
);

create table if not exists fuel_intakes (
  intake_id text primary key,
  source text not null,
  oil_type text default '柴油',
  amount numeric not null,
  remark text,
  created_at timestamptz not null default now(),
  client_record_id text unique
);

create table if not exists fuel_requests (
  request_id text primary key,
  applicant_id text references personnel(person_id),
  vehicle_id text references vehicles(vehicle_id),
  equipment_number text,
  equipment_type text,
  fuel_truck_number text,
  latitude double precision,
  longitude double precision,
  distance_m numeric,
  gps_status text,
  status text not null default 'waiting',
  remark text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  client_record_id text unique
);

create table if not exists fuel_records (
  fuel_id text primary key,
  request_id text references fuel_requests(request_id),
  vehicle_id text references vehicles(vehicle_id),
  vehicle_number text,
  driver_name text,
  amount numeric not null,
  photo_url text,
  confirmation_status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  confirmed_at timestamptz,
  rejected_at timestamptz,
  reject_reason text,
  client_record_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists fuel_stock_adjustments (
  adjustment_id text primary key,
  theory_stock numeric not null,
  actual_stock numeric not null,
  difference numeric not null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- =========================================================
-- 财务 / 工资
-- =========================================================

create table if not exists finance_costs (
  finance_cost_id text primary key,
  cost_month text not null,
  cost_type text not null,
  name text not null,
  department text,
  amount numeric not null,
  voucher_no text,
  remark text,
  source_type text,
  source_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists penalty_records (
  penalty_id text primary key,
  person_id text references personnel(person_id),
  amount numeric not null,
  reason text,
  source_type text,
  source_id text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists payroll_standards (
  standard_id text primary key,
  scope text not null,
  standard_type text,
  person_id text references personnel(person_id),
  position text,
  salary_mode text,
  base_salary numeric not null default 0,
  probation_salary numeric,
  regular_salary numeric,
  monthly_salary numeric,
  performance_unit_price numeric not null default 0,
  effective_date date,
  remark text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_rules (
  rule_id text primary key default 'default',
  rank1_reward numeric not null default 0,
  rank2_reward numeric not null default 0,
  rank3_reward numeric not null default 0,
  bottom1_deduction numeric not null default 0,
  bottom2_deduction numeric not null default 0,
  bottom3_deduction numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists payroll_monthly_records (
  payroll_id text primary key,
  payroll_month text not null,
  person_id text references personnel(person_id),
  base_amount numeric not null default 0,
  performance_amount numeric not null default 0,
  reward_amount numeric not null default 0,
  deduction_amount numeric not null default 0,
  final_amount numeric not null default 0,
  detail jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_payroll_monthly_person
on payroll_monthly_records(payroll_month, person_id);

create table if not exists payroll_monthly_locks (
  payroll_month text primary key,
  locked boolean not null default true,
  locked_by text references personnel(person_id),
  locked_at timestamptz not null default now(),
  remark text
);

create table if not exists payroll_audit_logs (
  id bigserial primary key,
  payroll_month text,
  person_id text references personnel(person_id),
  action text not null,
  actor_person_id text references personnel(person_id),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 推荐的通用更新时间函数
-- =========================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'personnel',
    'vehicles',
    'transport_zones',
    'dispatch_tasks',
    'equipment',
    'equipment_operational_status',
    'equipment_maintenance_settings',
    'warehouse_materials',
    'system_settings',
    'payroll_standards',
    'payroll_monthly_records'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on %I', t, t);
    execute format(
      'create trigger trg_%I_updated_at before update on %I for each row execute function set_updated_at()',
      t,
      t
    );
  end loop;
end $$;

-- =========================================================
-- 注意：RLS 策略暂不在 V1 自动开启。
-- 先完成数据迁移和角色模型后，再单独生成 rls-policies.sql。
-- =========================================================


-- =========================================================
-- Supabase Auth / 正式管理权限
-- =========================================================

-- 兼容已经创建过 personnel 表的项目
alter table public.personnel
add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists uq_personnel_auth_user_id
on public.personnel(auth_user_id)
where auth_user_id is not null;

create schema if not exists private;

create or replace function private.is_management_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personnel p
    where p.auth_user_id = (select auth.uid())
      and p.position in ('总经理', '管理员')
      and coalesce(p.approval_status, 'approved') = 'approved'
      and coalesce(p.enabled, true) = true
  );
$$;

revoke all on function private.is_management_user() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_management_user() to authenticated;

alter table public.general_manager_business_settings enable row level security;
alter table public.production_volume_settings enable row level security;

drop policy if exists "management config select" on public.general_manager_business_settings;
drop policy if exists "management config insert" on public.general_manager_business_settings;
drop policy if exists "management config update" on public.general_manager_business_settings;
drop policy if exists "management config delete" on public.general_manager_business_settings;

create policy "management config select"
on public.general_manager_business_settings
for select
to authenticated
using ((select private.is_management_user()));

create policy "management config insert"
on public.general_manager_business_settings
for insert
to authenticated
with check ((select private.is_management_user()));

create policy "management config update"
on public.general_manager_business_settings
for update
to authenticated
using ((select private.is_management_user()))
with check ((select private.is_management_user()));

create policy "management config delete"
on public.general_manager_business_settings
for delete
to authenticated
using ((select private.is_management_user()));

drop policy if exists "management volume select" on public.production_volume_settings;
drop policy if exists "management volume insert" on public.production_volume_settings;
drop policy if exists "management volume update" on public.production_volume_settings;
drop policy if exists "management volume delete" on public.production_volume_settings;

create policy "management volume select"
on public.production_volume_settings
for select
to authenticated
using ((select private.is_management_user()));

create policy "management volume insert"
on public.production_volume_settings
for insert
to authenticated
with check ((select private.is_management_user()));

create policy "management volume update"
on public.production_volume_settings
for update
to authenticated
using ((select private.is_management_user()))
with check ((select private.is_management_user()));

create policy "management volume delete"
on public.production_volume_settings
for delete
to authenticated
using ((select private.is_management_user()));

grant select, insert, update, delete
on public.general_manager_business_settings
to authenticated;

grant select, insert, update, delete
on public.production_volume_settings
to authenticated;
