/*
=========================================
矿山管理系统
driver-register.js V1.1
司机首次登记
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        const submitButton =
            document.getElementById("submitButton");


        if (!submitButton) {
            return;
        }


        /*
        如果本机已经登记过
        根据审核状态自动跳转
        */

        const oldData =
            localStorage.getItem(
                "driverProfile"
            );


        if (oldData) {

            try {

                const profile =
                    JSON.parse(oldData);


                if (
                    profile.status ===
                    "pending"
                ) {

                    location.href =
                        "driver-waiting.html";

                    return;

                }


                if (
                    profile.status ===
                    "approved"
                ) {

                    location.href =
                        "driver-work.html";

                    return;

                }

            }

            catch (error) {

                console.error(
                    "读取司机信息失败：",
                    error
                );

            }

        }


        /*
        提交登记
        */

        submitButton.addEventListener(
            "click",
            function () {

                const driverName =
                    document
                        .getElementById(
                            "driverName"
                        )
                        .value
                        .trim();


                const phone =
                    document
                        .getElementById(
                            "phone"
                        )
                        .value
                        .trim();


                const idCardNumber =
                    document
                        .getElementById(
                            "idCardNumber"
                        )
                        .value
                        .trim();


                const passportNumber =
                    document
                        .getElementById(
                            "passportNumber"
                        )
                        .value
                        .trim();


                const position =
                    document
                        .getElementById(
                            "position"
                        )
                        .value
                        .trim();


                const team =
                    document
                        .getElementById(
                            "team"
                        )
                        .value;


                const truckNumber =
                    document
                        .getElementById(
                            "truckNumber"
                        )
                        .value
                        .trim();


                const entryDate =
                    document
                        .getElementById(
                            "entryDate"
                        )
                        .value;


                const remark =
                    document
                        .getElementById(
                            "remark"
                        )
                        .value
                        .trim();


                /*
                必填检查
                */

                if (!driverName) {

                    alert("请输入姓名");

                    return;

                }


                if (!phone) {

                    alert("请输入手机号");

                    return;

                }


                if (!team) {

                    alert("请选择所属车队");

                    return;

                }


                if (!truckNumber) {

                    alert("请输入车辆编号");

                    return;

                }


                /*
                身份证号和护照号
                至少填写一个
                */

                if (
                    !idCardNumber &&
                    !passportNumber
                ) {

                    alert(
                        "身份证号和护照号至少填写一项"
                    );

                    return;

                }


                /*
                保存司机资料
                */

                const profile = {

                    driverId:
                        "DRIVER_"
                        +
                        Date.now(),

                    name:
                        driverName,

                    phone:
                        phone,

                    idCardNumber:
                        idCardNumber,

                    passportNumber:
                        passportNumber,

                    position:
                        position,

                    team:
                        team,

                    truckNumber:
                        truckNumber,

                    entryDate:
                        entryDate,

                    remark:
                        remark,

                    status:
                        "pending",

                    submittedAt:
                        new Date()
                            .toISOString()

                };


                localStorage.setItem(
                    "driverProfile",
                    JSON.stringify(profile)
                );


                location.href =
                    "driver-waiting.html";

            }
        );

    }
);
