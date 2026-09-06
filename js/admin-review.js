/*
=========================================
矿山管理系统
admin-review.js V1.1
管理员人员审核
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        const data =
            localStorage.getItem(
                "driverProfile"
            );


        const emptyMessage =
            document.getElementById(
                "emptyMessage"
            );


        const reviewCard =
            document.getElementById(
                "reviewCard"
            );


        if (!data) {

            emptyMessage.style.display =
                "block";

            reviewCard.style.display =
                "none";

            return;

        }


        let profile;


        try {

            profile =
                JSON.parse(data);

        }

        catch (error) {

            alert(
                "司机登记信息读取失败"
            );

            return;

        }


        emptyMessage.style.display =
            "none";

        reviewCard.style.display =
            "block";


        document
            .getElementById(
                "reviewName"
            )
            .textContent =
            profile.name || "";


        document
            .getElementById(
                "reviewPhone"
            )
            .textContent =
            profile.phone || "";


        document
            .getElementById(
                "reviewIdCardNumber"
            )
            .textContent =
            profile.idCardNumber ||
            "未填写";


        document
            .getElementById(
                "reviewPassportNumber"
            )
            .textContent =
            profile.passportNumber ||
            "未填写";


        document
            .getElementById(
                "reviewPosition"
            )
            .textContent =
            profile.position || "";


        document
            .getElementById(
                "reviewTeam"
            )
            .textContent =
            profile.team || "";


        document
            .getElementById(
                "reviewTruck"
            )
            .textContent =
            profile.truckNumber || "";


        document
            .getElementById(
                "reviewEntryDate"
            )
            .textContent =
            profile.entryDate ||
            "未填写";


        document
            .getElementById(
                "reviewRemark"
            )
            .textContent =
            profile.remark ||
            "无";


        document
            .getElementById(
                "reviewStatus"
            )
            .textContent =
            getStatusText(
                profile.status
            );


        document
            .getElementById(
                "approveButton"
            )
            .addEventListener(
                "click",
                function () {

                    const confirmed =
                        confirm(
                            "确认审核通过该司机吗？"
                        );


                    if (!confirmed) {

                        return;

                    }


                    profile.status =
                        "approved";


                    profile.approvedAt =
                        new Date()
                            .toISOString();


                    localStorage.setItem(
                        "driverProfile",
                        JSON.stringify(
                            profile
                        )
                    );


                    alert(
                        "审核已通过"
                    );


                    location.reload();

                }
            );


        document
            .getElementById(
                "rejectButton"
            )
            .addEventListener(
                "click",
                function () {

                    const confirmed =
                        confirm(
                            "确认审核不通过吗？"
                        );


                    if (!confirmed) {

                        return;

                    }


                    profile.status =
                        "rejected";


                    profile.rejectedAt =
                        new Date()
                            .toISOString();


                    localStorage.setItem(
                        "driverProfile",
                        JSON.stringify(
                            profile
                        )
                    );


                    alert(
                        "已设置为审核不通过"
                    );


                    location.reload();

                }
            );

    }
);



function getStatusText(
    status
) {

    if (
        status ===
        "pending"
    ) {

        return "待审核";

    }


    if (
        status ===
        "approved"
    ) {

        return "已通过";

    }


    if (
        status ===
        "rejected"
    ) {

        return "审核未通过";

    }


    return "未知状态";

}
