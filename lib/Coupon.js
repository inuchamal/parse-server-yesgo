/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const Define = require("./Define.js");
const utils = require("./Utils.js");
const conf = require("config");
const cardType = ["master", "visa", "other"];
const Messages = require('./Locales/Messages.js');
const UserDiscount = require('./UserDiscount.js').instance();
const RedisJobInstance = require('./RedisJob.js').instance();
const Mail = require('./mailTemplate.js');
const listFields = ["name", "endDate", "startDate", "type", "maxUse", "maxUsePerUser", "haveMaxUse", "countUsed", "value", "noAdmin", "status", "deleted", "updatedAt", "createdAt", "objectId", "ACL"];
const couponStatus = ["active", "inactive", "expired"];
const couponType = ["percent", "value"];
const listRequiredFields = [];
const response = require('./response');
function Coupon(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

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
            if (object.isNew()) {
                object.set("countUsed", 0)
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
        calculateDiscount: function (coupon, value) {
            let response = {value: value, couponValue: 0};
            if (coupon.get("type") === Define.typeOfValue.coupon) {
                let valueWithDiscount = value * (coupon.get("value") / 100);
                response.value = value - valueWithDiscount;
                response.couponValue = valueWithDiscount;
            } else {
                response.value = value - coupon.get("value");
                response.couponValue = coupon.get("value");
            }
            response.value < 0 && (response.value = 0);
            return response;
        },
        checkCoupon: function (name) {
            let query = new Parse.Query(Define.Coupon);
            // name = name.toLowerCase().trim();
            query.equalTo("name", name);
            query.equalTo("status", "active");
            return query.first().then(function (coupon) {
                if (!coupon) {
                    return utils.findObject(Parse.User, {"code": name}, true).then(function (user) {
                        if (!user) {
                            return Promise.reject(Messages(_language).error.ERROR_COUPON_NOT_FOUND);
                        } else {
                            return Promise.resolve(user);
                        }
                    })
                } else {
                    // let couponCode = coupon.get("name").toLowerCase().trim();
                    let couponCode = coupon.get("name");
                    return Promise.resolve(couponCode === name ? coupon : null)
                }
            }, function (error) {
                return Promise.reject(error);
            });
        },
        verifyCouponExpiration: function (coupon, offset, user, code) {
            let output = {
                discount: 0,
                type: ""
            };
            let date = new Date(new Date().setMinutes(new Date().getMinutes() + offset));
            if (date > coupon.get("endDate") || date < coupon.get("startDate")) {
                return Promise.reject(Messages(_language).error.ERROR_COUPON_NOT_FOUND);
            }
            if (coupon.get("maxUse") >= 0 && coupon.get("countUsed") >= coupon.get("maxUse")) {
                return Promise.reject(Messages(_language).error.ERROR_COUPON_LIMIT);
            }
            output.name = coupon.get("name") || undefined;
            output.type = coupon.get("type") || Define.typeOfValue.coupon;
            output.discount = coupon.get("value");
            if (output.type === "percentage") {
                output.type = Define.typeOfValue.coupon;
            }
            if (output.type === Define.typeOfValue.coupon) {
                output.discount /= 100;
            }

            //passando máximo de cupons por usuário
            output.maxUsePerUser = coupon.get("maxUsePerUser") || 1;

            output.objectId = coupon.id;
            return UserDiscount.createUserDiscount(code, user, output);
        },
        verifyIndicationCode: function (object, user, code) {
            let output = {
                discount: 0,
                type: ""
            }, userDisc;
            if (!object.has("codeDiscountCounter")) {
                object.set("codeDiscountCounter", 0);
            }
            //owner is trying to use his own code
            if (object.id === user.id) {
                if (object.get("codeDiscountCounter") <= 0) {
                    return Promise.reject(Messages(_language).error.ERROR_CODE_NOT_FOUND);
                } else {
                    object.increment("codeDiscountCounter", -1);
                    if (object.get("codeDiscountCounter") < 0) {
                        object.set("codeDiscountCounter", 0);
                    }
                }
            } else {
                object.increment("codeDiscountCounter");
            }
            return utils.findObject(Define.Config, null, true).then(function (config) {
                if (config) {
                    output.discount = config.get("indicationDiscount");
                    output.type = Define.typeOfValue.indicationCode;
                }
                return UserDiscount.createUserDiscount(code, user, output);
            }).then(function (userDiscount) {
                userDisc = userDiscount;
                return object.save(null, {useMasterKey: true});
            }).then(function (userDiscount) {
                return Promise.resolve(userDisc);
            }, function (error) {
                return Promise.reject(error);
            })
        },
        publicMethods: {
            createCoupon: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "endDate", "startDate", "value", "status"], _response)) {
                        _params.name = _params.name.toUpperCase();
                        if (couponStatus.indexOf(_params.status) < 0) {
                            _response.error("Status inválido! O status deve ser um dos seguintes: ", couponStatus);
                            return;
                        }
                        if (!_params.type) _params.type = "percent";
                        _params.haveMaxUse = (_params.maxUse && _params.maxUse > 0);
                        _params.endDate = new Date(_params.endDate);
                        _params.startDate = new Date(_params.startDate);
                        if (!(_params.endDate instanceof Date) || isNaN(_params.endDate)
                            || !(_params.startDate instanceof Date) || isNaN(_params.startDate)) {
                            _response.error(Messages(_language).error.ERROR_INVALID_DATE.code, Messages(_language).error.ERROR_INVALID_DATE.message);
                            return;
                        }
                        if (_params.active)
                            _params.status = _params.active ? "active" : "inactive";

                        _params.maxUsePerUser = _params.maxUsePerUser ? parseInt(_params.maxUsePerUser) : 1;
                        delete _params.active;
                        let coupon = new Define.Coupon();
                        delete _params.offset;
                        return coupon.save(_params).then(function (newCoupon) {
                            RedisJobInstance.addJob("Logger", "logCreateCoupon", {
                                objectId: newCoupon.id,
                                admin: _currentUser.id,
                                newInfo: {
                                    name: newCoupon.get("name"),
                                    value: newCoupon.get("value"),
                                    type: newCoupon.get("type")
                                }
                            });
                            if (_params.status && conf.sendUserNotificationWhenCreateCoupon) {
                                RedisJobInstance.addJob("PushNotification", "sendUserNotification", {
                                    "whoReceive": "passenger",
                                    "name": newCoupon.get("name"),
                                    "id": newCoupon.id,
                                    "type": "coupon",
                                    "couponType": newCoupon.get("type"),
                                    "value": newCoupon.get("value"),
                                    "date": newCoupon.createdAt,
                                    "endDate": newCoupon.get("endDate"),
                                    "startDate": newCoupon.get("startDate")
                                });
                            }
                            return _response.success({
                                objectId: newCoupon.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listCoupons: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 20000;
                        const page = (_params.page - 1 || 0) * limit;
                        let result = {};
                        if (_params.order) await utils.formatOrder(_params);

                        let queryCoupons = new Parse.Query(Define.Coupon);
                        queryCoupons.equalTo("noAdmin", null);
                        if (_params.ascendingBy) queryCoupons.ascending(_params.ascendingBy);
                        if (_params.descendingBy) queryCoupons.descending(_params.descendingBy);
                        if (_params.search) queryCoupons.matches("name", _params.search, "i");
                        result.totalCoupons = await queryCoupons.count();
                        queryCoupons.skip(page);
                        queryCoupons.limit(limit);
                        let coupons = await queryCoupons.find();
                        result.coupons = [];
                        for (let i = 0; i < coupons.length; i++) {
                            let json = utils.formatObjectToJson(coupons[i], ["name", "endDate", "haveMaxUse", "type", "maxUse", "startDate", "value", "status", "maxUsePerUser"]);
                            json.maxUse = json.maxUse - (coupons[i].get("countUsed") || 0);
                            json.active = json.status === "active";
                            json.maxUsePerUser = json.maxUsePerUser || 1;
                            result.coupons.push(json);
                        }
                      return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            verifyCoupon: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "offset"], _response)) {
                        _params.name = _params.name.toUpperCase();
                        return _super.checkCoupon(_params.name).then(function (object) {
                            if (object) {
                                if (object.has("endDate") && object.has("startDate") && object.get("status") === "active") {
                                    return _super.verifyCouponExpiration(object, _params.offset, _currentUser, _params.name);
                                } else if (object.has("username")) {
                                    return Promise.reject(Messages(_language).error.ERROR_COUPON_NOT_FOUND);
                                }
                            } else
                                return Promise.reject(Messages(_language).error.ERROR_COUPON_NOT_FOUND);
                        }).then(function (result) {
                            let output = result && result.get("discount") ? result.get("discount") : {
                                discount: 0,
                                type: ""
                            };
                          return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editCoupon: function () {
                let _oldInfo;
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["couponId"], _response)) {
                        _params.name = _params.name.toUpperCase();
                        return utils.getObjectById(_params.couponId, Define.Coupon).then(function (coupon) {
                            _oldInfo = coupon.toJSON();
                            delete _params.couponId;
                            _params.maxUsePerUser = _params.maxUsePerUser ? parseInt(_params.maxUsePerUser) : 1;
                            _params.status = _params.active ? "active" : "inactive";
                            delete _params.active;
                            return coupon.save(_params);
                        }).then(function (coupon) {
                            RedisJobInstance.addJob("Logger", "logEditCoupon", {
                                objectId: coupon.id,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: coupon.toJSON()
                            });
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deleteCoupon: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["couponId"], _response)) {
                        let _coupon;
                        return utils.getObjectById(_params.couponId, Define.Coupon).then(function (coupon) {
                            _coupon = {
                                name: coupon.get("name"),
                                value: coupon.get("value"),
                                type: coupon.get("type")
                            };
                            return coupon.destroy({useMasterKey: true});
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logDeleteCoupon", {
                                objectId: _params.couponId,
                                admin: _currentUser.id,
                                oldInfo: _coupon
                            });
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            changeCouponStatus: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["couponId", "status"], _response)) {
                        return utils.getObjectById(_params.couponId, Define.Coupon).then(function (coupon) {
                            if (couponStatus.indexOf(_params.status) < 0) {
                                _response.error("Status inválido! O status deve ser um dos seguintes: ", couponStatus);
                                return;
                            }
                            coupon.set("status", _params.status);
                            return coupon.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            getCouponById: async function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    if (utils.verifyRequiredFields(_params, ['couponId'], _response)) {
                        const fields = ["name", "type", "haveMaxUse", "maxUse", "startDate", "endDate", "value", "status", "maxUsePerUser", "haveMaxUse", "countUsed"];
                        let output = {};
                        try {
                            const coupon = await utils.getObjectById(_params.couponId, Define.Coupon, fields);
                            output = utils.formatObjectToJson(coupon, fields);
                          return _response.success(output);
                        } catch (e) {
                            _response.error(e.code, e.message);
                        }
                    }
                }
            },
        }
    };
    return _super;
}

exports.instance = Coupon;

Parse.Cloud.beforeSave("Coupon", async function (request) {
    await Coupon(request).beforeSave();
});
Parse.Cloud.beforeDelete("Coupon", async function (request) {
    await Coupon(request).beforeDelete();
});
for (let key in Coupon().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Coupon(request).publicMethods[request.functionName]();
    });
}
