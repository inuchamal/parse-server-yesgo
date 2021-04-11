'use strict';
const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define');
const Messages = require('./Locales/Messages.js');
const PaymentModule = require('./Payment/Payment.js').instance();
const listFields = ["defaultPercentage", "name", "icon", "updatedAt", "authData", "createdAt", "objectId", "ACL"];
const listRequiredFields = [];
const response = require('./response');
function Graduation(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;
    let _super = {
        beforeSave: () => {
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
        formatGraduation: (graduation) => {
            return {
                name: graduation.get('name'),
                objectId: graduation.id,
                icon: graduation.get('icon'),
                defaultPercentage: graduation.get('defaultPercentage')
            }
        },
        beforeDelete: () => {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        publicMethods: {
            createGraduation: () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["name", "defaultPercent"], _response)) {
                    let graduation = new Define.Graduation();
                    if (_params.name.length > 0) graduation.set("name", _params.name);
                    graduation.set("defaultPercentage", _params.defaultPercent);
                    if (_params.icon && _params.icon.length > 0) graduation.set('icon', _params.icon);
                    return graduation.save().then((grad) => {
                        return _response.success(grad)
                    }, (err) => {
                        return _response.error(err)
                    })
                }
            },
            listGraduations: () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let out = {total: 0, data: []};
                    let q = new Parse.Query(Define.Graduation);
                    return q.count().then((total) => {
                        out.total = total;
                        return q.find()
                    }).then((graduations) => {
                        for (let i = 0; i < graduations.length; i++) {
                            out.data.push(_super.formatGraduation(graduations[i]));
                        }
                        return _response.success(out);
                    }, (err) => {
                        return _response.error(err);
                    })
                }
            },
            deleteGraduation: () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["graduationId"], _response)) {
                    return new Parse.Query(Define.Graduation).get(_params.graduationId).then(async (graduation) => {
                        let uQuery = new Parse.Query(Parse.User);
                        uQuery.equalTo('patent', graduation);
                        let users = await uQuery.count();
                        if (users > 0) return Promise.reject(Messages(_language).error.ERROR_GRADUATION_IN_USE);
                        return graduation.destroy({useMasterKey: true})
                    }).then(() => {
                        return _response.success(Messages(_language).success.DELETED_SUCCESS)
                    }, (err) => {
                        return _response.error(err.code, err.message)
                    })
                }
            },
            setGraduationToDriver: () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["driverId"], _response)) {
                    let grad;
                    return (_params.graduationId ? new Parse.Query(Define.Graduation).get(_params.graduationId) : Promise.resolve()).then((graduation) => {
                        grad = graduation;
                        return new Parse.Query(Parse.User).get(_params.driverId)
                    }).then((driver) => {
                        let promises = [];
                        let splitValue = _params.customSplit ? _params.customSplit : grad.get('defaultPercentage');
                        driver.set('customSplit', splitValue);
                        promises.push(PaymentModule.updateRecipient({
                            userId: driver.id,
                            comission_percent: splitValue
                        }));
                        if (grad) driver.set('patent', grad);
                        promises.push(driver.save(null, {useMasterKey: true}));
                        return Promise.all(promises)
                    }).then(() => {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, (err) => {
                        return _response.error(err)
                    })
                }
            },

        }
    };
    return _super;
}

exports.instance = Graduation;

Parse.Cloud.beforeSave("Graduation", async function (request) {
    await Graduation(request).beforeSave();
});
Parse.Cloud.beforeDelete("Graduation", async function (request) {
    await Graduation(request).beforeDelete();
});
for (let key in Graduation().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Graduation(request).publicMethods[request.functionName]();
    });
}

