"use strict";

(function () {
    const watched = {
        payrollMonthlyRecords: {
            table: "payroll_monthly_records",
            ids: ["payrollId", "id"]
        },
        payrollMonthlyLocks: {
            table: "payroll_monthly_locks",
            ids: ["lockId", "id"]
        },
        payrollAuditLogs: {
            table: "payroll_audit_logs",
            ids: ["auditId", "id"]
        }
    };

    function getId(item, fields) {
        for (const field of fields) {
            const value = item?.[field];

            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return String(value);
            }
        }

        return "";
    }

    function parseRows(value) {
        try {
            const parsed =
                JSON.parse(
                    value ||
                    "[]"
                );

            return Array.isArray(parsed)
                ? parsed
                : [];
        } catch (error) {
            return [];
        }
    }

    function syncChangedRows(key, beforeRows, afterRows) {
        if (
            !window.MineDataService ||
            !watched[key]
        ) {
            return;
        }

        const config =
            watched[key];

        const previousMap =
            new Map(
                beforeRows
                    .map(item => [
                        getId(
                            item,
                            config.ids
                        ),
                        item
                    ])
                    .filter(([id]) => id)
            );

        afterRows.forEach(item => {
            const id =
                getId(
                    item,
                    config.ids
                );

            if (!id) {
                return;
            }

            const oldItem =
                previousMap.get(id);

            if (
                oldItem &&
                JSON.stringify(oldItem) ===
                    JSON.stringify(item)
            ) {
                return;
            }

            Promise.resolve(
                window.MineDataService.upsert(
                    config.table,
                    item
                )
            )
            .catch(error => {
                console.warn(
                    "DataService 工资数据同步失败，原本地流程已保留：",
                    key,
                    error
                );
            });
        });
    }

    if (
        window.__payrollDataBridgeInstalled
    ) {
        return;
    }

    const originalSetItem =
        Storage.prototype.setItem;

    Storage.prototype.setItem =
        function (key, value) {
            if (
                this !== window.localStorage ||
                !watched[key]
            ) {
                return originalSetItem.call(
                    this,
                    key,
                    value
                );
            }

            const beforeRows =
                parseRows(
                    this.getItem(
                        key
                    )
                );

            const result =
                originalSetItem.call(
                    this,
                    key,
                    value
                );

            const afterRows =
                parseRows(
                    this.getItem(
                        key
                    )
                );

            syncChangedRows(
                key,
                beforeRows,
                afterRows
            );

            return result;
        };

    window.__payrollDataBridgeInstalled =
        true;
})();
