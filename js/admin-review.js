document.addEventListener(
    "DOMContentLoaded",
    function () {

        const emptyMessage =
            document.getElementById(
                "emptyMessage"
            );


        const personnelTableArea =
            document.getElementById(
                "personnelTableArea"
            );


        const detailSection =
            document.getElementById(
                "detailSection"
            );


        const data =
            localStorage.getItem(
                "driverProfile"
            );


        if (!data) {

            emptyMessage.style.display =
                "block";

            personnelTableArea.style.display =
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
                "人员资料读取失败"
            );

            return;

        }


        emptyMessage.style.display =
            "none";

        personnelTableArea.style.display =
            "block";


        renderPersonnelTable(
            profile
        );


        window.openPersonnelDetail =
            function () {

                showPersonnelDetail(
                    profile
                );

            };


        document
            .getElementById(
                "approveButton"
            )
            .addEventListener(
                "click",
                function () {

                    if (
                        !confirm(
                            "确认审核通过该人员吗？"
                        )
                    ) {

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

                    if (
                        !confirm(
                            "确认审核不通过该人员吗？"
                        )
                    ) {

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
                        "审核未通过"
                    );


                    location.reload();

                }
            );


        document
            .getElementById(
                "printProfileButton"
            )
            .addEventListener(
                "click",
                function () {

                    printPersonnelProfile(
                        profile
                    );

                }
            );


        document
            .getElementById(
                "printPhotosButton"
            )
            .addEventListener(
                "click",
                function () {

                    printPersonnelPhotos(
                        profile
                    );

                }
            );


        document
            .getElementById(
                "closeDetailButton"
            )
            .addEventListener(
                "click",
                function () {

                    detailSection.style.display =
                        "none";

                }
            );

    }
);



function renderPersonnelTable(
    profile
) {

    const tableBody =
        document.getElementById(
            "personnelTableBody"
        );


    tableBody.innerHTML =
        `

        <tr>

            <td>
                ${escapeHtml(profile.name || "")}
            </td>

            <td>
                ${escapeHtml(profile.phone || "")}
            </td>

            <td>
                ${escapeHtml(profile.emergencyContact || "未填写")}
            </td>

            <td>
                ${escapeHtml(profile.emergencyPhone || "未填写")}
            </td>

            <td>
                ${escapeHtml(profile.position || "")}
            </td>

            <td>
                ${escapeHtml(profile.team || "")}
            </td>

            <td>
                ${escapeHtml(profile.entryDate || "未填写")}
            </td>

            <td>
                ${escapeHtml(getStatusText(profile.status))}
            </td>

            <td>

                <button
                    type="button"
                    onclick="openPersonnelDetail()"
                >
                    查看
                </button>

            </td>

        </tr>

        `;

}



function showPersonnelDetail(
    profile
) {

    setText(
        "detailName",
        profile.name
    );


    setText(
        "detailPhone",
        profile.phone
    );


    setText(
        "detailEmergencyContact",
        profile.emergencyContact ||
        "未填写"
    );


    setText(
        "detailEmergencyPhone",
        profile.emergencyPhone ||
        "未填写"
    );


    setText(
        "detailIdCardNumber",
        profile.idCardNumber ||
        "未填写"
    );


    setText(
        "detailPassportNumber",
        profile.passportNumber ||
        "未填写"
    );


    setText(
        "detailBankCardNumber",
        profile.bankCardNumber ||
        "未填写"
    );


    setText(
        "detailPosition",
        profile.position
    );


    setText(
        "detailTeam",
        profile.team
    );


    setText(
        "detailEntryDate",
        profile.entryDate ||
        "未填写"
    );


    setText(
        "detailRemark",
        profile.remark ||
        "无"
    );


    setText(
        "detailStatus",
        getStatusText(
            profile.status
        )
    );


    const photos =
        profile.photos || {};


    showPhoto(
        "detailIdCardPhoto",
        "idCardNoPhoto",
        photos.idCard
    );


    showPhoto(
        "detailPassportPhoto",
        "passportNoPhoto",
        photos.passport
    );


    showPhoto(
        "detailDriverLicensePhoto",
        "driverLicenseNoPhoto",
        photos.driverLicense
    );


    showPhoto(
        "detailBankCardPhoto",
        "bankCardNoPhoto",
        photos.bankCard
    );


    document
        .getElementById(
            "detailSection"
        )
        .style
        .display =
        "block";

}



function showPhoto(
    imageId,
    noPhotoId,
    imageData
) {

    const image =
        document.getElementById(
            imageId
        );


    const noPhoto =
        document.getElementById(
            noPhotoId
        );


    if (imageData) {

        image.src =
            imageData;

        image.style.display =
            "block";

        noPhoto.style.display =
            "none";

    }

    else {

        image.style.display =
            "none";

        noPhoto.style.display =
            "block";

    }

}



function printPersonnelProfile(
    profile
) {

    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {
        return;
    }


    printWindow.document.write(`

        <html>

        <head>

            <meta charset="UTF-8">

            <title>
                人员信息登记表
            </title>

            <style>

                body {
                    font-family:
                        Arial,
                        "Microsoft YaHei",
                        sans-serif;

                    padding: 30px;
                }

                h1 {
                    text-align: center;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                td {
                    border: 1px solid #333;
                    padding: 10px;
                }

                td:first-child {
                    width: 180px;
                    font-weight: bold;
                }

            </style>

        </head>


        <body>

            <h1>
                人员信息登记表
            </h1>


            <table>

                <tr>
                    <td>姓名</td>
                    <td>${escapeHtml(profile.name || "")}</td>
                </tr>

                <tr>
                    <td>手机号</td>
                    <td>${escapeHtml(profile.phone || "")}</td>
                </tr>

                <tr>
                    <td>紧急联系人</td>
                    <td>${escapeHtml(profile.emergencyContact || "未填写")}</td>
                </tr>

                <tr>
                    <td>紧急联系人电话</td>
                    <td>${escapeHtml(profile.emergencyPhone || "未填写")}</td>
                </tr>

                <tr>
                    <td>身份证号</td>
                    <td>${escapeHtml(profile.idCardNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>护照号</td>
                    <td>${escapeHtml(profile.passportNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>银行卡号</td>
                    <td>${escapeHtml(profile.bankCardNumber || "未填写")}</td>
                </tr>

                <tr>
                    <td>岗位</td>
                    <td>${escapeHtml(profile.position || "")}</td>
                </tr>

                <tr>
                    <td>所属车队</td>
                    <td>${escapeHtml(profile.team || "")}</td>
                </tr>

                <tr>
                    <td>入职日期</td>
                    <td>${escapeHtml(profile.entryDate || "未填写")}</td>
                </tr>

                <tr>
                    <td>审核状态</td>
                    <td>${escapeHtml(getStatusText(profile.status))}</td>
                </tr>

                <tr>
                    <td>备注</td>
                    <td>${escapeHtml(profile.remark || "无")}</td>
                </tr>

            </table>

        </body>

        </html>

    `);


    printWindow.document.close();


    setTimeout(
        function () {

            printWindow.print();

        },
        300
    );

}



function printPersonnelPhotos(
    profile
) {

    const photos =
        profile.photos || {};


    const availablePhotos =
        [];


    if (photos.idCard) {

        availablePhotos.push({
            title: "身份证照片",
            src: photos.idCard
        });

    }


    if (photos.passport) {

        availablePhotos.push({
            title: "护照照片",
            src: photos.passport
        });

    }


    if (photos.driverLicense) {

        availablePhotos.push({
            title: "驾驶证照片",
            src: photos.driverLicense
        });

    }


    if (photos.bankCard) {

        availablePhotos.push({
            title: "银行卡照片",
            src: photos.bankCard
        });

    }


    if (
        availablePhotos.length ===
        0
    ) {

        alert(
            "该人员没有上传证件照片"
        );

        return;

    }


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    let html =
        "";


    availablePhotos.forEach(
        function (photo) {

            html += `

                <div
                    style="
                        text-align:center;
                        margin-bottom:40px;
                    "
                >

                    <h2>
                        ${escapeHtml(photo.title)}
                    </h2>

                    <img
                        src="${photo.src}"
                        style="
                            max-width:100%;
                            max-height:800px;
                        "
                    >

                </div>

            `;

        }
    );


    printWindow.document.write(`

        <html>

        <head>

            <meta charset="UTF-8">

            <title>
                人员证件照片
            </title>

        </head>


        <body>

            <h1
                style="
                    text-align:center;
                "
            >
                ${escapeHtml(profile.name || "")}
                · 人员证件照片
            </h1>


            ${html}

        </body>

        </html>

    `);


    printWindow.document.close();


    setTimeout(
        function () {

            printWindow.print();

        },
        500
    );

}



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


    return "未知";

}



function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value || "";

    }

}



function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value || ""
        );


    return div.innerHTML;

}
