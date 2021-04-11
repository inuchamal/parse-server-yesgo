'use strict';
const Define = require("./Define.js");
const conf = require("config");
const utils = require("./Utils.js");
const listFields = ["text", "driver", "travel", "cancellationReason", "createdAt", "objectId", "updatedAt"];
const listRequiredFields = [];
const response = require('./response');
function DismissTravel(request) {
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
            return _response.success();
        },
        travelCancellationReason: async function (travel, user, listReasons, text) {
            try {
                let obj = new Define.DismissTravel;
                let reason = [];
                for (let i = 0; i < listReasons.length; i++) {
                    let data = await utils.getObjectById(listReasons[i], Define.Cancellation);
                    reason.push(data);
                }
                if (text)
                    obj.set("text", text);
                obj.set("cancellationReason", reason);
                obj.set("driver", user);
                obj.set("travel", travel);

                await obj.save(null, {useMasterKey: true});
                return Promise.resolve();
            } catch (error) {
                return Promise.reject({code: error.code, message: error.message});
            }
        },
        publicMethods: {
            getDismissReasonsByTravel: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, "admin", _response)) {
                        if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                            let data = [], cancellationReason;
                            const travel = await utils.getObjectById(_params.objectId, Define.Travel);
                            const dismiss = await utils.findObject(Define.DismissTravel, {travel: travel}, false);
                            for (let i in dismiss) {
                                for (const item of dismiss[i].get("cancellationReason")) {
                                    cancellationReason = await utils.getObjectById(item.id, Define.Cancellation);
                                    const duplicated = data.findIndex(redItem => {
                                        return item.id === redItem.id;
                                    }) > -1;
                                    if (!duplicated) {
                                        data.push({id: item.id, message: cancellationReason.get("descriptions")});
                                    }
                                }
                            }
                            _response.success(data);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        },
    }
    return _super;
}

exports.instance = DismissTravel;
Parse.Cloud.beforeSave("DismissTravel", async function (request) {
    await DismissTravel(request).beforeSave();
});

for (let key in DismissTravel().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await  DismissTravel(request).publicMethods[request.functionName]();
    });
}
