/**
 * Created by Marina on 10/01/2018.
 */

'use strict';
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const Define = require('./Define');
const Mail = require('./mailTemplate.js');
const os = require('os');
const conf = require('config');
const checkDiskSpace = require('check-disk-space');
const listFields = ["callBeforeScheduled", "countriesLanguages", "hasCancellation", "shareTextDriverEn", "shareTextPassengerEn", "shareTextDriverEs", "shareTextPassengerEs", "settingsOfDriverAlerts", "updateOldLocationDrivers", "colorBG", "landingPage", "logoImage", "supportEmail", "termosDeUsoDriver", "termosDeUsoDriverPassenger", "rulesToRecalculate", "linkPage", "valueStoped", "splitCall", "rulesToRecalculate", "dontRecalculateTravel", "numberOfRecentAddresses", "indicationDiscount", "shareTextPassenger", "shareTextDriver", "updatedAt", "authData", "cancellationFee", "createdAt", "objectId", "ACL", "_perishable_token", "hasOnlyOneDashboard", "timezoneDefault"];
const listRequiredFields = [];
const response = require('./response');
function Config(request) {
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
            return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        getTextToShare: async (user) => {
            try {
                let field2, field = user.get("isDriverApp") ? "shareTextDriver" : "shareTextPassenger";
                const language = user.get("language");
                let select = [field];
                switch (language) {
                    case "us":
                    case "en":
                    case "en_en":
                        field2 = field + "En";
                        select.push(field2);
                        break;
                    case "es_es":
                    case "es":
                        field2 = field + "Es";
                        select.push(field2);
                        break;
                    default:
                        break;
                }
                const config = await utils.findObject(Define.Config, {}, true, null, null, null, null, null, null, null, null, null, select);
                if (!config) return Promise.resolve("");
                const message = config.get(field2) || config.get(field);
                const code = (user.get("code") || "").toUpperCase();
                return Promise.resolve(message.replace("{{code}}", code.replace("#", "_")));
            } catch (error) {
                return Promise.reject(error);
            }
        },
        getLinkPage: async () => {
            try {
                let qConfig = new Parse.Query(Define.Config);
                qConfig = await qConfig.first();
                return (qConfig && qConfig.get("linkPage")) ? await Promise.resolve(qConfig.get("linkPage")) : await Promise.resolve(conf.linkPage);
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getSupportEmail: async () => {
            try {
                let qConfig = new Parse.Query(Define.Config);
                qConfig = await qConfig.first();
                return (qConfig && qConfig.get("supportEmail")) ? await Promise.resolve(qConfig.get("supportEmail")) : await Promise.resolve(conf.supportEmail);
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getConfig: async (name = "", valueDefault) => {
            try {
                if (!name)
                    return valueDefault;
                const qConfig = await utils.findObject(Define.Config, null, true);
                return qConfig.get(name) || conf[name] || valueDefault;
            } catch (e) {
                return null;
            }
        },
        getNumberOfRecentAddresses: () => {
            const qConfig = new Parse.Query(Define.Config);
            qConfig.select(["numberOfRecentAddresses"]);
            return qConfig.first();
        },
        getAllTextToShare: async () => {
            try {
                let qConfig = await utils.findObject(Define.Config, null, true);
                const obj = {
                    shareTextPassenger: qConfig.get("shareTextPassenger"),
                    shareTextDriver: qConfig.get("shareTextDriver"),
                    shareTextDriverEs: qConfig.get("shareTextDriverEs"),
                    shareTextPassengerEs: qConfig.get("shareTextPassengerEs"),
                    shareTextDriverEn: qConfig.get("shareTextDriverEn"),
                    shareTextPassengerEn: qConfig.get("shareTextPassengerEn")
                };
                return obj;
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getRecalculate: async () => {
            try {
                const qConfig = await utils.findObject(Define.Config, null, true);
                const obj = qConfig.get("rulesToRecalculate") || {enabled: false};
                return await Promise.resolve(obj);

            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getSplit: async () => {
            try {
                let qConfig = await utils.findObject(Define.Config, null, true);
                const obj = qConfig.get("splitCall") || {};
                return await Promise.resolve(obj);
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getBasicConfig: async () => {
            try {
                let qConfig = await utils.findObject(Define.Config, null, true);
                let obj = {};
                if (qConfig) {
                    obj = {
                        supportEmail: qConfig.get("supportEmail"),
                        linkPage: qConfig.get("linkPage"),
                        landingPage: qConfig.get("landingPage"),
                        colorBG: qConfig.get("colorBG"),
                        termosDeUsoDriver: qConfig.get("termosDeUsoDriver"),
                        termosDeUsoDriverPassenger: qConfig.get("termosDeUsoDriverPassenger"),
                        logoImage: qConfig.get("logoImage"),
                        numberOfRecentAddresses: qConfig.get("numberOfRecentAddresses"),
                    };
                    return await Promise.resolve(obj);
                }
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getCancellationFee: async () => {
            try {
                let qConfig = await utils.findObject(Define.Config, null, true);
                const obj = {
                    // hasCancellation: qConfig.get("hasCancellation"),
                    cancellationFee: qConfig.get("cancellationFee")
                };
                return obj;
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        getUpdateLocation: async () => {
            try {
                let qConfig = await utils.findObject(Define.Config, null, true);
                const obj = qConfig.get("updateOldLocationDrivers") || {"disable": true};
                obj.timeJob = obj.timeJob ? parseInt(obj.timeJob, 10) : undefined;
                return obj;
            } catch (error) {
                return await Promise.reject(error);
            }
        },
        publicMethods: {
            getFeatures: async () => {
                try {
                    const features = conf.features || [];
                    return _response.success({features});
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setBasicConfig: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["supportEmail", "linkPage", "landingPage", "colorBG", "termosDeUsoDriver", "termosDeUsoDriverPassenger", "logoImage"], _response)) {
                            let qConfig = await utils.findObject(Define.Config, null, true);
                            if (!qConfig) {
                                qConfig = new Define.Config();
                            }
                            const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                            if (!re.test(String(_params.supportEmail))) {
                                await Promise.reject({
                                    code: Messages(_language).error.ERROR_TYPE_EMAIL.code,
                                    message: Messages(_language).error.ERROR_TYPE_EMAIL.message
                                });
                            }
                            _params.numberOfRecentAddresses = _params.numberOfRecentAddresses || 3;
                            await qConfig.save(_params);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setRecalculate: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        let rulesToRecalculate = {enabled: false, minDiffKm: 0, minDiffMinutes: 0}, fields = [];
                        let qConfig = await utils.findObject(Define.Config, null, true);
                        if (!qConfig) {
                            qConfig = new Define.Config();
                        }
                        if (typeof _params.enabled === "boolean")  {
                            if (_params.enabled) fields = ["minDiffKm", "minDiffMinutes"];
                            else {
                                delete _params.minDiffKm;
                                delete _params.minDiffMinutes;
                            }
                            if (utils.verifyRequiredFields(_params, fields, _response)) {
                                rulesToRecalculate = {
                                    enabled: _params.enabled,
                                    minDiffKm: _params.minDiffKm,
                                    minDiffMinutes: _params.minDiffMinutes
                                };
                                qConfig.set("rulesToRecalculate", rulesToRecalculate);
                            }
                            await qConfig.save(null);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        } else await Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getRecalculate: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            return _response.success(await _super.getRecalculate());
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setSplit: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["type"], _response)) {
                            let splitCall = {}, fields = [];
                            let qConfig = await utils.findObject(Define.Config, null, true);
                            if (!qConfig) {
                                qConfig = new Define.Config();
                            }
                            if (_params.type === "auction"){
                                splitCall = {type: "auction"}
                            } else {
                                if (_params.type === "hybrid") {
                                    fields = ["countReceivers", "splitTimeInSeconds", "callAllAfter", "secondLimitAfterCallAll"];
                                } else if (_params.type === "queue") {
                                    fields = ["countReceivers", "splitTimeInSeconds"];
                                    delete _params.secondLimitAfterCallAll;
                                    delete _params.callAllAfter;
                                } else await Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                                if (utils.verifyRequiredFields(_params, fields, _response)) {
                                    splitCall = {
                                        type: _params.type,
                                        countReceivers: _params.countReceivers,
                                        splitTimeInSeconds: _params.splitTimeInSeconds,
                                        callAllAfter: _params.callAllAfter,
                                        secondLimitAfterCallAll: _params.secondLimitAfterCallAll
                                    };

                                }
                            }
                            qConfig.set("splitCall", splitCall);
                            await qConfig.save(null, {useMasterKey: true});
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getSplit: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            return _response.success(await _super.getSplit());
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createConfig: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["indicationDiscount"], _response)) {
                        return utils.findObject(Define.Config, null, true).then(function (config) {
                            let conf;
                            if (!config) {
                                conf = new Define.Config();
                            } else conf = config;
                            return conf.save(_params);
                        }).then(function () {
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error);
                        })
                    }
                }
            },
            getServerStatus: () => {
                let path = os.platform() === 'win32' ? 'C:' : '/';
                let p = new Promise(((resolve, reject) => {
                    utils.CPULoad(1000, (load) => {
                        resolve((100 * load).toFixed(1))
                    });
                }));
                return p.then(async (cpu) => {
                    let disckSpace;
                    try {
                        disckSpace = await checkDiskSpace(path);
                    } catch (e) {
                        return _response.error(e)
                    }
                    let serverdata = {
                        freeMem: os.freemem(),
                        totalMem: os.totalmem(),
                        sysuptime: os.uptime(),
                        cpuUsage: cpu,
                        freedisk: disckSpace.free,
                        totalDisk: disckSpace.size,
                        date: new Date().getTime()
                    };
                    return _response.success(serverdata);
                }, (err) => {
                    return _response.error(err)
                })
            },
            editConfig: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    return utils.findObject(Define.Config, null, true).then(function (config) {
                        if (_params.type && _params.content) config.set(_params.type, _params.content);
                        delete _params.type;
                        delete _params.content;
                        return config.save(_params);
                    }).then(function () {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error);
                    })
                }
            },
            getConfig: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            const config = await utils.findObject(Define.Config, null, true);
                            const obj = await _super.getAllTextToShare();
                            obj.indicationDiscount = config.get("indicationDiscount") || 0;
                            obj.cancellationFee = config.get("cancellationFee");
                            return _response.success(obj);
                        }
                    }
                } catch (error) {
                    _response.error(error);
                }
            },
            setCancellationFee: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        // if (typeof _params.hasCancellation !== "boolean")
                        //     await Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                        const fields = _params.hasCancellation ? ["cancellationFee"] : [];
                        if (utils.verifyRequiredFields(_params, fields, _response)) {
                            let qConfig = await utils.findObject(Define.Config, null, true);
                            if (!qConfig) qConfig = new Define.Config();
                            qConfig.set("hasCancellation", _params.hasCancellation);
                            // if (!_params.hasCancellation) qConfig.unset("cancellationFee");
                            // else
                            qConfig.set("cancellationFee", _params.cancellationFee); //driverCancellationTax
                            await qConfig.save(null, {useMasterKey: true});
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getCancellationFee: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            return _response.success(await _super.getCancellationFee());
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setUpdateLocation: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (typeof _params.disable !== "boolean")
                            await Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                        const fields = !_params.disable ? ["timeJob", "diffMinutes"] : [];
                        if (utils.verifyRequiredFields(_params, fields, _response)) {
                            let qConfig = await utils.findObject(Define.Config, null, true);
                            if (!qConfig) qConfig = new Define.Config();
                            if (_params.disable) {
                                delete _params.timeJob;
                                delete _params.diffMinutes;
                            }
                            const obj = {
                                timeJob: _params.timeJob ? _params.timeJob.toString() + " seconds" : undefined,
                                diffMinutes: _params.diffMinutes,
                                disable: _params.disable
                            };
                            qConfig.set("updateOldLocationDrivers", obj);
                            await qConfig.save(null, {useMasterKey: true});
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getUpdateLocation: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        return _response.success(await _super.getUpdateLocation());
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setTextToShare: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["shareTextPassenger", "shareTextDriver"], _response)) {
                            let qConfig = await utils.findObject(Define.Config, null, true);
                            await qConfig.save(_params);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            driverSummary: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            const plan = {total: await utils.countObject(Define.Plan, {active: true})};
                            const document = {
                                optional: await utils.countObject(Define.Document, {required: false}),
                                required: await utils.countObject(Define.Document, {required: true})
                            };
                            return _response.success({document: document, plan: plan});
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            travelSummary: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            const radius = await utils.countObject(Define.Radius);
                            const split = await _super.getSplit();
                            const cancellation = await _super.getCancellationFee();
                            const recalculate = await _super.getRecalculate();
                            const cancellationReason = await utils.countObject(Define.Cancellation, {activated: true});
                          return _response.success({
                                radius: radius,
                                split: split,
                                recalculate: recalculate,
                                cancellation: cancellation,
                                cancellationReason: cancellationReason
                            });
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            notificationSummary: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            const obj = {
                                updateOldLocationDrivers: await _super.getUpdateLocation()
                            };
                          return _response.success(obj);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            sharingSummary: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            let qConfig = await utils.findObject(Define.Config, null, true);
                          return _response.success({indicationDiscount: qConfig.get("indicationDiscount") || 0});
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getLanguagesApp: async () => {
                try {
                    let qConfig = await utils.findObject(Define.Config, null, true);
                    const countriesLanguages = qConfig.get("countriesLanguages") ? qConfig.get("countriesLanguages") : [{
                        "label": "Português",
                        "key": "pt",
                        "default": true
                    }];
                  return _response.success({countriesLanguages: countriesLanguages});
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = Config;

/* CALLBACKS */
Parse.Cloud.beforeSave("Config", async function (request) {
    await Config(request).beforeSave();
});
Parse.Cloud.beforeDelete("Config", async function (request) {
   await Config(request).beforeDelete();
});
for (let key in Config().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Config(request).publicMethods[request.functionName]();
    });
}
