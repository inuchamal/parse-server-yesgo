/**
 * Created by Marina on 05/12/2017.
 */

'use strict';
const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define');
const listFields = ["user", "platform", "version", "manufacturer", "permission", "appVersion", "app", "model", "language", "updatedAt", "authData", "createdAt", "objectId", "ACL",];
const listRequiredFields = [];
const response = require('./response');
function DeviceInfo(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let wrongFields = utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error("Field(s) '" + wrongFields + "' not supported.");
                return;
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
          return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
              return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        verifyIfOldVersion: function (user, originalValue, coupon, value) {
            if (!coupon || (coupon && originalValue)) return Promise.resolve({valid: true, value: originalValue})
            return utils.getObjectById(coupon, Define.Coupon).then(function (objCoupon) {
                if (objCoupon.get("type") === "percent") {
                    return Promise.resolve({valid: true, value: value / (1 - (objCoupon.get("value") / 100))});
                }
                return Promise.resolve({valid: false});
            });
        },
        saveDeviceInfo: function (user, info, isDriverApp) {
            if (!info || !user)
                return Promise.resolve();
            let query = new Parse.Query(Define.DeviceInfo);
            query.equalTo("user", user);
            query.descending("createdAt");
            return query.first().then(function (deviceInfo) {
                if (deviceInfo && info.version === deviceInfo.get("version") &&
                    info.manufacturer === deviceInfo.get("manufacturer") &&
                    info.model === deviceInfo.get("model") &&
                    info.appVersion === deviceInfo.get("appVersion") &&
                    info.platform === deviceInfo.get("platform")) {
                } else {
                    deviceInfo = new Define.DeviceInfo();
                    deviceInfo.set("user", user);
                    deviceInfo.set("platform", info.platform);
                    deviceInfo.set("version", info.version);
                    deviceInfo.set("manufacturer", info.manufacturer);
                    deviceInfo.set("model", info.model);
                    deviceInfo.set("language", info.language);
                    deviceInfo.set("appVersion", info.appVersion);
                    deviceInfo.set("app", isDriverApp ? "driver" : "passenger");
                    deviceInfo.set("permission", info.permission)
                }
                return deviceInfo.save(null, {useMasterKey: true});
            });
        },
        publicMethods: {
            getDevicesInfo: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId", "app"], _response)) {
                        let _total;
                        const limit = _params.limit || 100;
                        const page = ((_params.page || 1) - 1) * limit;
                        delete _params.limit;
                        delete _params.page;
                        let query = new Parse.Query(Define.DeviceInfo);
                        return utils.getObjectById(_params.userId, Parse.User, null).then(function (user) {
                            query.equalTo("user", user);
                            query.equalTo("app", _params.app);
                            return query.count();
                        }).then(function (count) {
                            _total = count;
                            query.limit(limit);
                            query.skip(page);
                            query.select(["platform", "version", "manufacturer", "appVersion", "app", "model", "language"]);
                            query.descending("createdAt");
                            return query.find();
                        }).then(function (devices) {
                            let output = {};
                            let data = [];
                            for (let i = 0; i < devices.length; i++)
                                data.push(utils.formatObjectToJson(devices[i], ["platform", "version", "manufacturer", "appVersion", "app", "model", "language"]));
                            output.total = _total;
                            output.devices = data;
                          return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            }
        }
    };
    return _super;
}

exports.instance = DeviceInfo;

Parse.Cloud.beforeSave("DeviceInfo", async function (request) {
    await DeviceInfo(request).beforeSave();
});
Parse.Cloud.beforeDelete("DeviceInfo", async function (request) {
    await DeviceInfo(request).beforeDelete();
});
for (let key in DeviceInfo().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await DeviceInfo(request).publicMethods[request.functionName]();
    });
}

