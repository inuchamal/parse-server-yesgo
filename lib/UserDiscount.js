'use strict';
const utils = require("./Utils.js");
const Define = require('./Define.js');
const conf = require("config");
const BonusInstance = require('./Bonus.js').instance();
const Mail = require('./mailTemplate.js');
const Messages = require('./Locales/Messages.js');
const listFields = ["originalCode", "nameSearch", "owner", "user", "used", "countUsed", "discount", "couponId", "code", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "_email_verify_token", "emailVerified"];
const listRequiredFields = [];
const response = require('./response');
function UserDiscount(request) {
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
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
            if (object.isNew()) {
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
        markUserDiscount: function (user, coupon, marked) {
            if (!coupon) return Promise.resolve();
            let _object;
            return utils.findObject(Define.UserDiscount, {user: user, couponId: coupon}, true).then(function (object) {
                _object = object;
                if (!_object) return Promise.resolve();
                return utils.getObjectById(coupon, Define.Coupon);
            }).then(function (objCoupon) {
                if (!objCoupon || !_object) return Promise.resolve();
                objCoupon.increment("countUsed", (marked ? 1 : -1));
                _object.increment("countUsed", (marked ? 1 : -1));
                _object.set("used", marked);
                return Parse.Object.saveAll([_object, objCoupon], {useMasterKey: true});
            });
        },
        createUserDiscount: function (indicationCode, user, discountData) {
            let _user;
            return utils.findObject(Parse.User, {"code": indicationCode}, true).then(function (owner) {
                _user = owner;
                // let obj = owner ? {"user": user, "owner": owner, "code": indicationCode} : {
                //     "user": user,
                //     "code": indicationCode
                // };
                let obj = owner ? {"user": user, "owner": owner, "code": indicationCode} : {
                    "user": user,
                    "couponId": discountData.objectId
                };
                return utils.findObject(Define.UserDiscount, obj, true);
            }).then(function (userDiscount) {
                if (!userDiscount) {
                    userDiscount = new Define.UserDiscount();
                    userDiscount.set("user", user);
                    userDiscount.set("owner", _user);
                    userDiscount.set("nameSearch", indicationCode.toLowerCase());
                    userDiscount.set("code", indicationCode);
                    userDiscount.set("originalCode", indicationCode);
                    userDiscount.set("used", false);
                    userDiscount.set("countUsed", 0);
                } else {

                    if (!userDiscount.get("countUsed") && userDiscount.get("used"))
                        userDiscount.set("countUsed", 1);

                    //verificando limite de uso deste cupom para este usuário
                    if (userDiscount.get("countUsed") >= discountData.maxUsePerUser)
                        return Promise.reject(Messages(_language).error.ERROR_MAX_COUPON_PER_USER);
                }
                userDiscount.set("couponId", discountData.objectId);
                userDiscount.set("discount", discountData);
                userDiscount.set("code", indicationCode);
                return userDiscount.save(null, {useMasterKey: true});
            }, function (error) {
                return Promise.reject(error);
            });
        },
        findAndUpdate: function (user, code) {
            if (user.get("whoInvite")) {
                return Promise.resolve();
            }
            let query = new Parse.Query(Parse.User);
            query.matches("code", code.toUpperCase(), "i");
            return query.first().then(function (whoInvite) {
                if (!whoInvite) return Promise.resolve();
                return BonusInstance.saveUserIndication(user, whoInvite);
            });
        },
        importUserDiscountToWhoInvite: function () {
            let query = new Parse.Query(Define.UserDiscount);
            query.contains("nameSearch", "#");
            query.include("user");
            query.limit(100000);
            return query.find().then(function (discounts) {
                let promises = [];
                for (let i = 0; i < discounts.length; i++) {
                    promises.push(_super.findAndUpdate(discounts[i].get("user"), discounts[i].get("code")));
                }
                return Promise.all(promises);
            });

        },
        publicMethods: {
            listUserDiscounts: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let limit = _params.limit || 20000;
                    let page = (_params.page || 0) * limit;
                    let result = {};
                    return utils.findObject(Define.UserDiscount, {
                        "owner": _currentUser,
                        "used": true
                    }, false, "user", null, null, null, {"user": _currentUser}).then(function (discounts) {
                        result.totalDiscounts = discounts.length; //COUNTING WITH LIMIT OF 9999999
                        result.discounts = [];
                        discounts = discounts.slice(page).slice(0, limit); //MANUAL PAGINATION
                        for (let i = 0; i < discounts.length; i++) {
                            let obj = utils.formatObjectToJson(discounts[i], ["code", "used"], true);
                            obj.friend = utils.formatPFObjectInJson(discounts[i].get("user"), ["name", "lastName"]);
                            obj.value = discounts[i].get("discount").discount;
                            result.discounts.push(obj);
                        }
                        return _response.success(result);
                    });
                }
            },
        }
    };
    return _super;
}

exports.instance = UserDiscount;

/* CALLBACKS */
Parse.Cloud.beforeSave("UserDiscount", async function (request) {
    await UserDiscount(request).beforeSave();
});
Parse.Cloud.beforeDelete("UserDiscount", async function (request) {
    await UserDiscount(request).beforeDelete();
});
for (var key in UserDiscount().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await UserDiscount(request).publicMethods[request.functionName]();
    });
}
