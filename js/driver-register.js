/*
=========================================
矿山管理系统
driver-register.js V2.0

功能：
1. 司机首次登记
2. 保存身份证号
3. 保存护照号
4. 保存银行卡号
5. 上传身份证照片
6. 上传护照照片
7. 上传驾驶证照片
8. 上传银行卡照片
9. 自动压缩上传图片
10. 提交后进入等待审核页面
=========================================
*/


document.addEventListener(
    "DOMContentLoaded",
    function () {

        const submitButton =
            document.getElementById(
                "submitButton"
            );


        if (!submitButton) {
            return;
        }


        /*
        =====================================
        检查本机是否已经登记
        =====================================
        */

        const oldData =
            localStorage.getItem(
                "driverProfile"
            );


        if (oldData) {

            try {

                const profile =
                    JSON.parse(oldData);


                /*
                待审核
                */

                if (
                    profile.status ===
                    "pending"
                ) {

                    location.href =
                        "driver-waiting.html";

                    return;

                }


                /*
                已审核通过
                */

                if (
                    profile.status ===
                    "approved"
                ) {

                    location.href =
                        "driver-work.html";

                    return;

                }


                /*
                rejected
                审核不通过时
                允许重新填写
                */

            }

            catch (error) {

                console.error(
                    "读取原司机资料失败：",
                    error
                );

            }

        }



        /*
        =====================================
        点击提交
        =====================================
        */

        submitButton.addEventListener(
            "click",
            async function () {

                /*
                防止连续点击
                */

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "正在提交...";


                try {

                    /*
                    =============================
                    读取基本资料
                    =============================
                    */

                    const driverName =
                        getValue(
                            "driverName"
                        );


                    const phone =
                        getValue(
                            "phone"
                        );


                    const idCardNumber =
                        getValue(
                            "idCardNumber"
                        );


                    const passportNumber =
                        getValue(
                            "passportNumber"
                        );


                    const bankCardNumber =
                        getValue(
                            "bankCardNumber"
                        );


                    const position =
                        getValue(
                            "position"
                        );


                    const team =
                        getValue(
                            "team"
                        );


                    const entryDate =
                        getValue(
                            "entryDate"
                        );


                    const remark =
                        getValue(
                            "remark"
                        );



                    /*
                    =============================
                    基本资料验证
                    =============================
                    */

                    if (!driverName) {

                        alert(
                            "请输入姓名"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!phone) {

                        alert(
                            "请输入手机号"
                        );

                        resetSubmitButton();

                        return;

                    }


                    if (!team) {

                        alert(
                            "请选择所属车队"
                        );

                        resetSubmitButton();

                        return;

                    }


                    /*
                    身份证号和护照号
                    至少填写其中一个
                    */

                    if (
                        !idCardNumber &&
                        !passportNumber
                    ) {

                        alert(
                            "身份证号和护照号至少填写一项"
                        );

                        resetSubmitButton();

                        return;

                    }



                    /*
                    =============================
                    获取照片文件
                    =============================
                    */

                    const idCardFile =
                        getFile(
                            "idCardPhoto"
                        );


                    const passportFile =
                        getFile(
                            "passportPhoto"
                        );


                    const driverLicenseFile =
                        getFile(
                            "driverLicensePhoto"
                        );


                    const bankCardFile =
                        getFile(
                            "bankCardPhoto"
                        );



                    /*
                    =============================
                    图片格式检查
                    =============================
                    */

                    const files = [

                        {
                            name:
                                "身份证照片",

                            file:
                                idCardFile
                        },

                        {
                            name:
                                "护照照片",

                            file:
                                passportFile
                        },

                        {
                            name:
                                "驾驶证照片",

                            file:
                                driverLicenseFile
                        },

                        {
                            name:
                                "银行卡照片",

                            file:
                                bankCardFile
                        }

                    ];


                    for (
                        const item
                        of files
                    ) {

                        if (
                            item.file &&
                            !item.file.type
                                .startsWith(
                                    "image/"
                                )
                        ) {

                            alert(
                                item.name
                                +
                                "必须上传图片文件"
                            );

                            resetSubmitButton();

                            return;

                        }

                    }



                    /*
                    =============================
                    压缩照片
                    =============================
                    */

                    const idCardPhoto =
                        await compressImage(
                            idCardFile
                        );


                    const passportPhoto =
                        await compressImage(
                            passportFile
                        );


                    const driverLicensePhoto =
                        await compressImage(
                            driverLicenseFile
                        );


                    const bankCardPhoto =
                        await compressImage(
                            bankCardFile
                        );



                    /*
                    =============================
                    建立人员资料
                    =============================
                    */

                    const profile = {

                        /*
                        本地人员编号
                        */

                        driverId:
                            "DRIVER_"
                            +
                            Date.now(),


                        /*
                        基本资料
                        */

                        name:
                            driverName,

                        phone:
                            phone,

                        idCardNumber:
                            idCardNumber,

                        passportNumber:
                            passportNumber,

                        bankCardNumber:
                            bankCardNumber,

                        position:
                            position,

                        team:
                            team,

                        entryDate:
                            entryDate,

                        remark:
                            remark,


                        /*
                        证件照片
                        */

                        photos: {

                            idCard:
                                idCardPhoto,

                            passport:
                                passportPhoto,

                            driverLicense:
                                driverLicensePhoto,

                            bankCard:
                                bankCardPhoto

                        },


                        /*
                        审核状态
                        */

                        status:
                            "pending",


                        /*
                        提交时间
                        */

                        submittedAt:
                            new Date()
                                .toISOString()

                    };



                    /*
                    =============================
                    保存到浏览器
                    =============================
                    */

                    try {

                        localStorage.setItem(
                            "driverProfile",
                            JSON.stringify(
                                profile
                            )
                        );

                    }

                    catch (storageError) {

                        console.error(
                            "资料保存失败：",
                            storageError
                        );


                        alert(
                            "照片数据过大，浏览器无法保存。\n\n请重新上传尺寸较小的照片进行测试。"
                        );


                        resetSubmitButton();

                        return;

                    }



                    /*
                    =============================
                    保存成功
                    =============================
                    */

                    alert(
                        "人员信息提交成功，等待管理员审核。"
                    );


                    location.href =
                        "driver-waiting.html";

                }

                catch (error) {

                    console.error(
                        "登记提交失败：",
                        error
                    );


                    alert(
                        "提交失败，请检查填写内容和上传照片后重新尝试。"
                    );


                    resetSubmitButton();

                }

            }
        );



        /*
        =====================================
        获取输入框内容
        =====================================
        */

        function getValue(
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (!element) {

                return "";

            }


            return element.value
                .trim();

        }



        /*
        =====================================
        获取上传文件
        =====================================
        */

        function getFile(
            id
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (
                !element ||
                !element.files ||
                element.files.length === 0
            ) {

                return null;

            }


            return element.files[0];

        }



        /*
        =====================================
        恢复提交按钮
        =====================================
        */

        function resetSubmitButton() {

            submitButton.disabled =
                false;


            submitButton.textContent =
                "提交审核";

        }

    }
);



/*
=========================================
图片压缩
=========================================

最大宽高：
1200px

JPEG质量：
0.7
=========================================
*/

function compressImage(
    file
) {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            /*
            没有上传照片
            */

            if (!file) {

                resolve("");

                return;

            }


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    const image =
                        new Image();


                    image.onload =
                        function () {

                            let width =
                                image.width;


                            let height =
                                image.height;


                            const maxSize =
                                1200;



                            /*
                            计算压缩尺寸
                            */

                            if (
                                width >
                                maxSize ||
                                height >
                                maxSize
                            ) {

                                if (
                                    width >
                                    height
                                ) {

                                    height =
                                        Math.round(
                                            height
                                            *
                                            maxSize
                                            /
                                            width
                                        );


                                    width =
                                        maxSize;

                                }

                                else {

                                    width =
                                        Math.round(
                                            width
                                            *
                                            maxSize
                                            /
                                            height
                                        );


                                    height =
                                        maxSize;

                                }

                            }



                            /*
                            创建画布
                            */

                            const canvas =
                                document
                                    .createElement(
                                        "canvas"
                                    );


                            canvas.width =
                                width;


                            canvas.height =
                                height;



                            const context =
                                canvas
                                    .getContext(
                                        "2d"
                                    );



                            /*
                            白色背景
                            */

                            context.fillStyle =
                                "#ffffff";


                            context.fillRect(
                                0,
                                0,
                                width,
                                height
                            );



                            /*
                            绘制图片
                            */

                            context.drawImage(
                                image,
                                0,
                                0,
                                width,
                                height
                            );



                            /*
                            输出JPEG
                            */

                            const compressedData =
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.7
                                );


                            resolve(
                                compressedData
                            );

                        };


                    image.onerror =
                        function () {

                            reject(
                                new Error(
                                    "图片读取失败"
                                )
                            );

                        };


                    image.src =
                        event.target.result;

                };


            reader.onerror =
                function () {

                    reject(
                        new Error(
                            "文件读取失败"
                        )
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}
