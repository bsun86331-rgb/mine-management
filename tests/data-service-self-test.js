"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const DATA_SERVICE_PATH = path.join(ROOT, "js", "data-service.js");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function createStorage() {
    const map = new Map();

    return {
        getItem(key) {
            return map.has(key)
                ? map.get(key)
                : null;
        },

        setItem(key, value) {
            map.set(
                String(key),
                String(value)
            );
        },

        removeItem(key) {
            map.delete(
                String(key)
            );
        },

        clear() {
            map.clear();
        },

        dump() {
            return Object.fromEntries(
                map.entries()
            );
        }
    };
}

function createContext() {
    const localStorage = createStorage();
    const sessionStorage = createStorage();

    const context = {
        window: null,
        localStorage,
        sessionStorage,
        fetch: async () => {
            throw new Error(
                "自检阶段禁止真实网络请求"
            );
        },
        console,
        setTimeout,
        clearTimeout,
        JSON,
        Date,
        Math
    };

    context.window = context;

    vm.createContext(
        context
    );

    return context;
}

function loadDataService(context) {
    const code = fs.readFileSync(
        DATA_SERVICE_PATH,
        "utf8"
    );

    vm.runInContext(
        code,
        context,
        {
            filename:
                "data-service.js"
        }
    );

    assert(
        context.MineDataService,
        "MineDataService 未加载"
    );

    return context.MineDataService;
}

async function main() {
    const context =
        createContext();

    const ds =
        loadDataService(
            context
        );

    console.log("");
    console.log("DataService 自检开始");

    assert(
        ds.version ===
            "1.0.0",
        "版本号异常"
    );

    assert(
        ds.config.mode ===
            "local",
        "默认模式不是 local"
    );

    console.log(
        "1. local 模式加载：PASS"
    );

    await ds.insert(
        "personnel",
        {
            personId:
                "TEST-DATA-PERSON-001",

            name:
                "TEST-数据层人员",

            position:
                "管理员",

            status:
                "active"
        }
    );

    const personnel =
        await ds.list(
            "personnel"
        );

    assert(
        Array.isArray(
            personnel
        ) &&
        personnel.length ===
            1,
        "insert/list 失败"
    );

    assert(
        String(
            personnel[0]
                .client_record_id ||
                ""
        )
        .startsWith(
            "CLIENTREC-"
        ),
        "未自动生成 client_record_id"
    );

    console.log(
        "2. insert / list：PASS"
    );

    const sameClientRecordId =
        personnel[0]
            .client_record_id;

    await ds.insert(
        "personnel",
        {
            personId:
                "TEST-DATA-PERSON-002",

            name:
                "TEST-重复写入",

            position:
                "管理员",

            status:
                "active",

            client_record_id:
                sameClientRecordId
        }
    );

    const afterDuplicate =
        await ds.list(
            "personnel"
        );

    assert(
        afterDuplicate.length ===
            1,
        "client_record_id 去重失败"
    );

    console.log(
        "3. client_record_id 去重：PASS"
    );

    await ds.update(
        "personnel",
        "TEST-DATA-PERSON-001",
        {
            department:
                "TEST-管理部"
        }
    );

    const updated =
        await ds.get(
            "personnel",
            "TEST-DATA-PERSON-001"
        );

    assert(
        updated &&
        updated.department ===
            "TEST-管理部",
        "update/get 失败"
    );

    console.log(
        "4. update / get：PASS"
    );

    await ds.upsert(
        "vehicles",
        {
            vehicleId:
                "TEST-DATA-VEHICLE-001",

            vehicleNumber:
                "TEST-V001",

            status:
                "active"
        }
    );

    await ds.upsert(
        "vehicles",
        {
            vehicleId:
                "TEST-DATA-VEHICLE-001",

            vehicleNumber:
                "TEST-V001",

            status:
                "working"
        }
    );

    const vehicles =
        await ds.list(
            "vehicles"
        );

    assert(
        vehicles.length ===
            1 &&
        vehicles[0].status ===
            "working",
        "upsert 失败"
    );

    console.log(
        "5. upsert：PASS"
    );

    await ds.softDelete(
        "vehicles",
        "TEST-DATA-VEHICLE-001"
    );

    const deleted =
        await ds.get(
            "vehicles",
            "TEST-DATA-VEHICLE-001"
        );

    assert(
        deleted &&
        deleted.status ===
            "disabled" &&
        deleted.deleted_at,
        "softDelete 失败"
    );

    console.log(
        "6. 软删除：PASS"
    );

    await ds.setSingleton(
        "attendance_geofence_config",
        {
            enabled:
                true,

            name:
                "TEST-考勤点",

            radiusMeters:
                100
        }
    );

    const singleton =
        await ds.list(
            "attendance_geofence_config"
        );

    assert(
        singleton &&
        singleton.name ===
            "TEST-考勤点",
        "singleton 读写失败"
    );

    console.log(
        "7. singleton 配置：PASS"
    );

    const pending =
        ds.getPendingQueue();

    assert(
        Array.isArray(
            pending
        ) &&
        pending.length >=
            5,
        "pending queue 未生成"
    );

    assert(
        pending.every(
            item =>
                item.status ===
                    "pending" &&
                String(
                    item.queue_id ||
                    ""
                )
                .startsWith(
                    "QUEUE-"
                )
        ),
        "pending queue 结构异常"
    );

    console.log(
        "8. pending queue：PASS"
    );

    const beforeSync =
        pending.length;

    const syncResult =
        await ds.syncPendingQueue();

    assert(
        syncResult &&
        syncResult.skipped ===
            true &&
        syncResult.pending ===
            beforeSync,
        "local 模式同步跳过逻辑异常"
    );

    console.log(
        "9. local 模式同步保护：PASS"
    );

    const storageSnapshot =
        context.localStorage.dump();

    assert(
        Object.keys(
            storageSnapshot
        )
        .every(
            key =>
                key !==
                "personnelRecords" ||
                String(
                    storageSnapshot[
                        key
                    ]
                )
                .includes(
                    "TEST-DATA-"
                )
        ),
        "自检写入了非 TEST personnel 数据"
    );

    const allBusinessValues =
        Object.entries(
            storageSnapshot
        )
        .filter(
            ([key]) =>
                ![
                    "mineDataPendingQueue",
                    "mineDataClientId"
                ].includes(
                    key
                )
        );


    for (
        const [
            key,
            value
        ]
        of allBusinessValues
    ) {

        const parsed =
            (() => {

                try {

                    return JSON.parse(
                        value
                    );

                } catch (
                    error
                ) {

                    return null;
                }
            })();


        const rows =
            Array.isArray(
                parsed
            )
                ? parsed
                : [
                    parsed
                ];


        for (
            const row
            of rows
        ) {

            if (
                !row ||
                typeof row !==
                    "object"
            ) {

                continue;
            }


            const serialized =
                JSON.stringify(
                    row
                );


            assert(
                serialized.includes(
                    "TEST-"
                ) ||
                key ===
                    "attendanceGeofenceConfig",
                "发现非 TEST 自检业务数据，key=" +
                key
            );
        }
    }

    console.log(
        "10. TEST 数据隔离：PASS"
    );

    console.log("");
    console.log(
        "DataService 自检完成：10/10 PASS"
    );
    console.log(
        "正式页面尚未接入 DataService，现有 37/37 基线不受影响。"
    );
}

main()
    .catch(
        error => {

            console.error("");
            console.error(
                "DataService 自检失败：",
                error?.message ||
                error
            );

            process.exitCode =
                1;
        }
    );
