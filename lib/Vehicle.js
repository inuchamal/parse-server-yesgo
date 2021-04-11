/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const Define = require("./Define.js");
const utils = require("./Utils.js");
const UserClass = require('./User.js');
const conf = require("config");
const Messages = require('./Locales/Messages.js');
const Mail = require('./mailTemplate.js');
const FirebaseClass = require('./Firebase.js');
const PushNotification = require('./PushNotification').instance();
const RedisJobInstance = require('./RedisJob.js').instance();
const PaymentInstance = require('./Payment/Payment.js').instance();
const listFields = ["optional", "primary", "isApproved", "category", "crlv", "status", "user", "brand", "model", "year", "color", 'plate', "deleted", "updatedAt", "createdAt", "objectId", "ACL"];
const listRequiredFields = [];
const response = require('./response');
function Vehicle(request) {
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
                object.set("deleted", false);
            }
            return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages(_language).error.ERROR_UNAUTHORIZED);
            }
        },
        getVehicleByDriver: function (driver) {
            var query = new Parse.Query(DefineClass.Vehicle);
            query.equalTo("deleted", false);
            query.equalTo("user", driver);
            query.select(["model", "year", "color", 'plate']);
            return query.first();
        },
        formatDocsSent: function (doc) {
            let locale = _language || "pt";
            let description = doc.get("description") || undefined;
            let link = doc.get("link") || undefined;
            let name = doc.get("name") || undefined;
            if (conf.appIsMultilingual && locale !== "pt") {
                description = doc.get("description_" + locale) || description;
                link = doc.get("link_" + locale) || link;
                name = doc.get("name_" + locale) || name;
            }
            return {
                objectId: doc.id,
                userDocumentId: null,
                status: "required",
                name,
                description,
                required: doc.get("required"),
                link,
                roundPicture: doc.get("roundPicture")
            }
        },
        addDocumentToVehicle: function (docId, link) {
            let qDoc = new Parse.Query(Define.Document);
            return qDoc.get(docId, {useMasterKey: true}).then(function (document) {
                let crlv = new Define.UserDocument();
                crlv.set("document", document);
                crlv.set("user", _currentUser);
                crlv.set("additional", true);
                crlv.set("link", link);
                crlv.set("status", "sent");
                return crlv.save(null, {useMasterKey: true});
            }, function (error) {
                return Promise.reject(error);
            });
        },
        formatVehicle: function (vehicle, userdocument = false) {
            let category = vehicle.get("category") || undefined;
            let crlv = userdocument || vehicle.get("crlv") || undefined;
            let output = {
                user: {
                    name: vehicle.get("user") ? vehicle.get("user").get("name") : undefined,
                    profileImage: vehicle.get("user") ? vehicle.get("user").get("profileImage") : undefined,
                    objectId: vehicle.get("user") ? vehicle.get("user").id : undefined
                },
                primary: vehicle.get("primary") || false,
                category: category ? {
                    name: category.get("name") || null,
                    objectId: category.id,
                } : undefined,
                status: vehicle.get("status") || "approved",
                crlv: crlv ? {
                    objectId: crlv.id,
                    name: crlv.get("name") || "CRLV",
                    link: crlv.get("link") || null
                } : undefined,
                deleted: false,
                brand: vehicle.get("brand") || null,
                color: vehicle.get("color") || null,
                model: vehicle.get("model") || null,
                plate: vehicle.get("plate") || null,
                year: vehicle.get("year") || null,
                createdAt: vehicle.get("createdAt").toJSON(),
                updatedAt: vehicle.get("updatedAt").toJSON(),
                objectId: vehicle.id
            };

            return output;
        },
        saveDocumentInOriginalVehicleJob: async (id, data) => {
            try {
                let userdocument = new Define.UserDocument();
                userdocument.id = id;
                let queryDriver = new Parse.Query(Parse.User);
                let driver = await queryDriver.get(data.userId, {useMasterKey: true});
                let queryVehicle = new Parse.Query(Define.Vehicle);
                queryVehicle.equalTo("user", driver);
                let vehicle = await queryVehicle.first();
                if (vehicle) {
                    vehicle.set("crlv", userdocument);
                    await vehicle.save(null, {useMasterKey: true});
                }
            } catch (e) {
                console.log(e);
            }
        },
        publicMethods: {
            createVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId", "model", "year", "color", "plate", "brand"], _response)) {
                        let _cat;
                        let locale = _currentUser.get("locale") || "pt";
                        let {catId, model, year, color, plate, brand} = _params;
                        //verificando plate
                        if (locale === "es" || locale === "bo") {
                            if (!utils.verifyPatternOfPlateBolivia(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else if (locale === "ao") {
                            if (!utils.verifyPatternOfPlateAngola(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else {
                            if (!utils.verifyPatternOfPlate(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        }


                        return utils.getObjectById(catId, Define.Category).then(function (cat) {
                            _cat = cat;
                            return utils.findObject(Define.Vehicle, {"plate": plate, "user": _currentUser}, true, null);
                        }).then(function (vehicle) {
                            //se já existe veículo com esta placa
                            if (vehicle)
                                return Promise.reject(Messages(_language).error.ERROR_PLATE_EXISTS);
                            else {
                                let vehicle = new Define.Vehicle();
                                vehicle.set("category", _cat);
                                vehicle.set("user", _currentUser);
                                vehicle.set("primary", false);
                                vehicle.set("deleted", false);
                                vehicle.set("optional", true);
                                vehicle.set("status", "pending");
                                vehicle.set("color", color);
                                vehicle.set("model", model);
                                vehicle.set("year", year);
                                vehicle.set("plate", plate);
                                vehicle.set("brand", brand);
                                return vehicle.save(null, {useMasterKey: true});
                            }
                        }).then(function (vehicle) {
                            return _response.success(vehicle.id);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            createVehicleFlow: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId", "docId", "docLink", "model", "year", "color", "plate", "brand"], _response)) {
                        let _cat;
                        let {catId, model, year, color, plate, brand, docId, linkDoc} = _params;
                        //verificando plate
                        if (!utils.verifyPatternOfPlate(plate))
                            return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);

                        return utils.getObjectById(catId, Define.Category).then(function (cat) {
                            _cat = cat;
                            return utils.findObject(Define.Vehicle, {"plate": plate}, true, null);
                        }).then(function (vehicle) {
                            //se já existe veículo com esta placa
                            if (vehicle)
                                return Promise.reject(Messages(_language).error.ERROR_PLATE_EXISTS);
                            else
                                return _super.addDocumentToVehicle(docId, linkDoc);
                        }).then(function (crlv) {
                            let vehicle = new Define.Vehicle();
                            vehicle.set("category", _cat);
                            vehicle.set("user", _currentUser);
                            vehicle.set("primary", false);
                            vehicle.set("deleted", false);
                            vehicle.set("status", "waiting");
                            vehicle.set("crlv", crlv);
                            vehicle.set("color", color);
                            vehicle.set("model", model);
                            vehicle.set("year", year);
                            vehicle.set("plate", plate);
                            vehicle.set("brand", brand);
                            return vehicle.save(null, {useMasterKey: true});
                        }).then(function (vehicle) {
                            return _response.success(vehicle.id);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listVehicleDocsSent: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    let _sentDocs = {};
                    return utils.findObject(Define.Document, {name: "CRLV"}).then(function (requiredDocuments) {
                        for (let i = 0; i < requiredDocuments.length; i++) {
                            if (_sentDocs[requiredDocuments[i].id]) {

                            } else {
                                _sentDocs[requiredDocuments[i].id] = _super.formatDocsSent(requiredDocuments[i]);
                            }
                        }
                        let objs = [];
                        for (let key in _sentDocs) {
                            objs.push(_sentDocs[key]);
                        }
                        return _response.success(objs);
                    })
                }
            },
            createVehicleAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["driverId", "catId", "model", "year", "color", "plate", "brand"], _response)) {
                        let _cat, _user;
                        let {driverId, catId, model, year, color, plate, brand} = _params;
                        //verificando plate
                        if (!utils.verifyPatternOfPlate(plate))
                            return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);

                        return utils.getObjectById(catId, Define.Category).then(function (cat) {
                            _cat = cat;
                            return utils.getObjectById(driverId, Parse.User);
                        }).then(function (user) {
                            _user = user;
                            return utils.findObject(Define.Vehicle, {"plate": plate}, true, null);
                        }).then(async function (vehicle) {
                            //se já existe veículo com esta placa
                            if (vehicle)
                                return Promise.reject(Messages(_language).error.ERROR_PLATE_EXISTS);
                            else if (_params.linkDoc) {
                                const doc = await utils.findObject(Define.Document, {name: "CRLV"}, true);
                                return _super.addDocumentToVehicle(doc.id, _params.linkDoc);
                            }
                        }).then(function (crlv) {
                            let vehicle = new Define.Vehicle();
                            vehicle.set("category", _cat);
                            vehicle.set("user", _user);
                            vehicle.set("primary", false);
                            vehicle.set("deleted", false);
                            vehicle.set("status", "awaiting");
                            vehicle.set("crlv", crlv);
                            vehicle.set("color", color);
                            vehicle.set("model", model);
                            vehicle.set("year", year);
                            vehicle.set("plate", plate);
                            vehicle.set("brand", brand);
                            return vehicle.save(null, {useMasterKey: true});
                        }).then(function (vehicle) {
                            return _response.success(vehicle.id);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            updateVehicleData: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["model", "year", "color", "plate", "brand"], _response)) {
                        let locale = _currentUser.get("locale") || "pt";

                        if (locale === "es" || locale === "bo") {
                            if (!utils.verifyPatternOfPlateBolivia(_params.plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else if (locale === "ao") {
                            if (!utils.verifyPatternOfPlateAngola(_params.plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else {
                            if (!utils.verifyPatternOfPlate(_params.plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        }

                        return utils.findObject(Define.Vehicle, {
                            "primary": true,
                            "user": _currentUser
                        }, true, "category").then(function (vehicle) {
                            if (vehicle.has("category") && parseInt(vehicle.get("category").get("year")) > parseInt(_params.year)) {
                                return Promise.reject({
                                    code: 619,
                                    message: "Ano inválido. O veículo deve ser pelo menos de " + vehicle.get("category").get("year")
                                });
                            }
                            if (_params.category) delete _params.category;

                            let promises = [];
                            promises.push(vehicle.save(_params));

                            if (_currentUser.get("profileStage") === Define.profileStage["5"])
                                _currentUser.set("profileStage", Define.profileStage["6"]);
                            promises.push(_currentUser.save(null, {useMasterKey: true}));
                            promises.push(UserClass.instance().formatUser(_currentUser));
                            return Promise.all(promises);
                        }).then(function (resultPromsies) {
                            FirebaseClass.instance().updateUserInfo(resultPromsies[2]);
                            return _response.success(_currentUser.get("profileStage"))
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            saveVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["model", "year", "color", 'plate'], _response)) {
                        let _vehicleSaved;
                        return _super.createVehicle(_currentUser, _params.objectId, _params.model, _params.year, _params.color, _params.plate).then(function (vehicleSaved) {
                            _vehicleSaved = vehicleSaved;
                            _currentUser.set("vehicle", vehicleSaved);
                            return _currentUser.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _response.success(_vehicleSaved);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    var query = new Parse.Query(DefineClass.Vehicle);
                    query.equalTo("user", _currentUser);
                    query.equalTo("deleted", false);
                    query.first().then(function (result) {
                        return _response.success(result);
                    });
                }
            },
            listVehicles: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    var query = new Parse.Query(Define.Vehicle);
                    query.equalTo("user", _currentUser);
                    query.equalTo("deleted", false);
                    query.include("category");
                    return query.find().then(function (vehicles) {
                        let data = [];
                        for (let i = 0; i < vehicles.length; i++)
                            data.push(_super.formatVehicle(vehicles[i]));
                        return _response.success(data);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listVehiclesByDriver: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["driverId"], _response)) {
                            let userdocument;
                            const user = await utils.getObjectById(_params.driverId, Parse.User);
                            const crlv = await utils.findObject(Define.Document, {code: "CRLV"}, true);
                            if (!crlv) throw Messages(_language).error.ERROR_OBJECT_NOT_FOUND;
                            const total = await utils.countObject(Define.Vehicle, {user: user, deleted: false});
                            const limit = _params.limit || 10;
                            const page = ((_params.page || 1) - 1) * limit;
                            const vehicles = await utils.findObject(Define.Vehicle, {
                                user: user,
                                deleted: false
                            }, false, ["category", "crlv"], "status", "primary", null, null, limit, null, null, page);
                            let data = [];
                            for (let i = 0; i < vehicles.length; i++) {
                                if (!vehicles[i].get("crlv") && !vehicles[i].get("optional")) {
                                    userdocument = await utils.findObject(Define.UserDocument, {
                                        document: crlv,
                                        user: user
                                    }, true, null, null, null, null, {additional: true});
                                    data.push(_super.formatVehicle(vehicles[i], userdocument));
                                } else
                                    data.push(_super.formatVehicle(vehicles[i]));
                            }
                            return _response.success({total: total, vehicles: data});
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listVehiclesAwaiting: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page || 1) - 1) * limit;
                        const include = ["category", "crlv", "user", "category.name", "crlv.link", "user.name", "user.profileImage", "primary", "status", "brand", "color", "model", "plate", "year"];
                        const queryVehicle = new Parse.Query(Define.Vehicle);
                        await utils.formatOrder(_params);
                        if (_params.userName) {
                            queryVehicle.matchesQuery("user", new Parse.Query(Parse.User).matches('name', _params.userName));
                        }
                        if (_params.categoryId) {
                            queryVehicle.matchesQuery("category", new Parse.Query(Define.Category).matches('objectId', _params.categoryId));
                        }
                        if (_params.status) queryVehicle.matches("status", _params.status);
                        if (_params.year) queryVehicle.matches("year", _params.year);
                        queryVehicle.equalTo("deleted", false);
                        queryVehicle.containedIn("status", ["awaiting", "pending"]);
                        const total = await queryVehicle.count();
                        queryVehicle.include(include);
                        queryVehicle.limit(limit);
                        queryVehicle.skip(page);
                        if (_params.ascendingBy) queryVehicle.ascending(_params.ascendingBy);
                        if (_params.descendingBy) queryVehicle.descending(_params.descendingBy);
                        const vehicles = await queryVehicle.find({useMasterKey: true});
                        let data = [];
                        for (let i = 0; i < vehicles.length; i++) {
                            data.push(_super.formatVehicle(vehicles[i]));
                        }
                        return _response.success({total: total, vehicles: data});
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            deleteVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId"], _response)) {
                        let promise, _vehicle, _owner, _isPrimary, _newPrimaryVehicle, _crlv, _cat,
                            _newCat;
                        let promises = [];
                        //verificando parâmetro driverId
                        if (_params.driverId) {
                            let qUser = new Parse.Query(Parse.User);
                            promise = qUser.get(_params.driverId);
                        } else
                            promise = Promise.resolve(undefined);

                        return promise.then(function (driver) {
                            _owner = driver || _currentUser;
                            let qVehicle = new Parse.Query(Define.Vehicle);
                            return qVehicle.get(_params.vehicleId);
                        }).then(function (vehicle) {
                            _vehicle = vehicle;
                            _isPrimary = _vehicle.get("primary") || false;
                            _cat = _vehicle.get("category") || undefined;
                            _crlv = _vehicle.get("crlv") || undefined;

                            //buscando outro véiculo que possa se tornar o principal [1] get another vehicle
                            if (_isPrimary) {
                                return utils.findObject(Define.Vehicle, {
                                    "user": _owner,
                                    "status": "approved"
                                }, true, null, null, null, null, {"objectId": _vehicle.id});
                            } else
                                return Promise.resolve(undefined);
                        }).then(function (newPrimaryVehicle) {
                            //se existe outro véiculo que possa se torna principal
                            if (_isPrimary) {
                                if (newPrimaryVehicle) {
                                    _newCat = newPrimaryVehicle.get("category") || undefined;
                                    newPrimaryVehicle.set("primary", true);
                                    return newPrimaryVehicle.save(null, {useMasterKey: true});
                                } else
                                    return Promise.reject(Messages(_language).error.ERROR_NEED_PRIMARY_VEHICLE);
                            } else
                                return Promise.resolve();
                        }).then(function () {
                            promises = [];
                            //destruindo veículo
                            promises.push(_vehicle.destroy({useMasterKey: true}));
                            //atualizando categoria do veículo excluido
                            if (_cat) {
                                _cat.increment("counter", -1);
                                promises.push(_cat.save(null, {useMasterKey: true}));
                            }
                            //atualizando categoria do novo veículo principal
                            if (_newCat) {
                                _newCat.increment("counter");
                                promises.push(_newCat.save(null, {useMasterKey: true}));
                            }
                            //se existe documento
                            if (_crlv)
                                promises.push(_crlv.destroy({useMasterKey: true}));
                            return Promise.all(promises);
                        }).then(function () {
                            return UserClass.instance().updateUserInFirebase(_owner, false, false);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getVehicleById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return _super.getVehicleById(_params.objectId, null, {user: _currentUser}).then(function (result) {
                            return _response.success(result);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            addDocumentToVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId", "docId", "link"], _response)) {
                        let promises = [], _vehicle, _owner, _document;
                        //Verificando parâmetro driverId [0] get driver
                        if (_params.driverId) {
                            let qUser = new Parse.Query(Parse.User);
                            promises.push(qUser.get(_params.driverId));
                        } else
                            promises.push(Promise.resolve(undefined));

                        //resgatando documento [1] get Document
                        let qDoc = new Parse.Query(Define.Document);
                        promises.push(qDoc.get(_params.docId));

                        return Promise.all(promises).then(function (results) {
                            promises = [];
                            let driver = results[0];
                            _document = results[1];
                            _owner = driver || _currentUser;
                            let qVehicle = new Parse.Query(Define.Vehicle);
                            return qVehicle.get(_params.vehicleId)
                        }).then(function (vehicle) {
                            _vehicle = vehicle;
                            let status = _vehicle.get("status") || null;
                            let crlv = _vehicle.get("crlv") || null;
                            if (status && status === "approved")
                                return Promise.reject(Messages(_language).error.ERROR_APPROVE_VEHICLE);
                            //verificando dono do véiculo
                            if (_vehicle.get("user") && _vehicle.get("user").id !== _owner.id)
                                return Promise.reject(Messages(_language).error.ERROR_OWNER_VEHICLE);

                            //se existe userdocument
                            if (!crlv) {
                                crlv = new Define.UserDocument();
                                crlv.set("document", _document);
                                crlv.set("user", _owner);
                                crlv.set("additional", true);
                            }
                            crlv.set("link", _params.link);
                            crlv.set("status", "sent");
                            return crlv.save(null, {useMasterKey: true});
                        }).then(function (crlv) {
                            _vehicle.set("crlv", crlv);
                            _vehicle.set("status", "awaiting");
                            return _vehicle.save(null, {useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listVehiclesByCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            return utils.findObject(Define.Vehicle, {"category": cat});
                        }).then(function (vehicles) {
                          return _response.success(utils.formatObjectArrayToJson(vehicles, ["brand", "model"]));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            changeCategoryOfVehicle: function () {
                let _vehicle;
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["categoryId", "vehicleId"], _response)) {
                        let _category, oldCategory;
                        return utils.getObjectById(_params.categoryId, Define.Category).then(function (category) {
                            _category = category;
                            return utils.getObjectById(_params.vehicleId, Define.Vehicle, ["category", "user"]);
                        }).then(function (vehicle) {
                            _vehicle = vehicle;
                            oldCategory = vehicle.get("category");
                            vehicle.set("category", _category);

                            _category.increment("counter");
                            oldCategory.increment("counter", -1);

                            return Parse.Object.saveAll([vehicle, _category, oldCategory]);
                        }).then(function () {
                            return UserClass.instance().updateUserInFirebase(_vehicle.get("user"), false, false);
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            changeColorOfVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["color", "vehicleId"], _response)) {
                        let _category, oldCategory;
                        return utils.getObjectById(_params.vehicleId, Define.Vehicle).then(function (vehicle) {
                            oldCategory = vehicle.get("category");
                            vehicle.set("color", _params.color.toString().trim());

                            return vehicle.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId"], _response)) {
                        let _oldInfo;
                        let {vehicleId, plate, brand, model, year, color, category} = _params;
                        if (plate && conf.appName.toLowerCase() === 'flipmob') {
                            if (!utils.verifyPatternOfPlateBolivia(plate) && !utils.verifyPatternOfPlate(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else if (plate && conf.appName.toLowerCase() === 'diuka') {
                            if (!utils.verifyPatternOfPlateAngola(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        } else {
                            if (plate && !utils.verifyPatternOfPlate(plate))
                                return _response.error(Messages(_language).error.ERROR_INVALID_PLATE.code, Messages(_language).error.ERROR_INVALID_PLATE.message);
                        }
                        return utils.getObjectById(vehicleId, Define.Vehicle).then(async function (vehicle) {
                            _oldInfo = vehicle.toJSON();
                            if (brand)
                                vehicle.set("brand", brand.toString().trim());
                            if (model)
                                vehicle.set("model", model.toString().trim());
                            if (plate)
                                vehicle.set("plate", plate.toString().trim());
                            if (year)
                                vehicle.set("year", year.toString().trim());
                            if (color)
                                vehicle.set("color", color.toString().trim());
                            if (category) {
                                // let cat = await utils.getObjectById(category, Define.Category);
                                let cat = await utils.findObject(Define.Category, {'objectId': category}, true);
                                if (!cat) {
                                    cat = await utils.findObject(Define.Category, {'name': category}, true)
                                }
                                vehicle.set("category", cat);
                            }

                            return vehicle.save();
                        }).then(function (newVehicle) {
                            RedisJobInstance.addJob("Logger", "logEditVehicle", {
                                objectId: vehicleId,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: newVehicle.toJSON()
                            });
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            approveVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId"], _response)) {

                        let _owner, _vehicle, _cat, _crlv;
                        return utils.getObjectById(_params.vehicleId, Define.Vehicle).then(function (vehicle) {
                            let status = vehicle.get("status") || false;
                            _owner = vehicle.get("user");
                            _vehicle = vehicle;
                            _cat = vehicle.get("category") || undefined;
                            _crlv = vehicle.get("crlv") || undefined;

                            //verificando category
                            if (!_crlv)
                                return Promise.reject(Messages(_language).error.ERROR_DOCUMENT_VEHICLE);
                            if (!_cat)
                                return Promise.reject(Messages(_language).error.ERROR_CATEGORY_VEHICLE);
                            //verificando se o veiculo é o principal
                            if (status && status === "approved")
                                return Promise.reject(Messages(_language).error.ERROR_APPROVE_VEHICLE);

                            let objects = [];
                            //atualizando status do documento do veículo
                            _crlv.set("status", "approved");
                            //atualizando status do veículo
                            _vehicle.set("status", "approved");
                            //atualizando contador de veículos da categoria
                            _cat.increment("counter");
                            objects.push(_crlv);
                            objects.push(_vehicle);
                            objects.push(_cat);
                            return Parse.Object.saveAll(objects, {useMasterKey: true});
                        }).then(function () {
                            return PushNotification.sendPushToUsers(_owner.id, Messages(_owner.get("language") || null).push.approveVehicle, Define.pushTypes.userVehicleApproved, "driver");
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            rejectVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId"], _response)) {

                        let _owner, _vehicle, _cat, _crlv;
                        return utils.getObjectById(_params.vehicleId, Define.Vehicle).then(function (vehicle) {
                            let primary = vehicle.get("primary") || false;
                            _owner = vehicle.get("user");
                            _vehicle = vehicle;
                            _cat = vehicle.get("category") || undefined;
                            _crlv = vehicle.get("crlv") || undefined;
                            //verificando category
                            if (!_cat)
                                return Promise.reject(Messages(_language).error.ERROR_CATEGORY_VEHICLE);
                            //Verificando se o veiculo é o principal
                            if (primary)
                                return Promise.reject(Messages(_language).error.ERROR_PRIMARY_VEHICLE);
                            let objects = [];
                            //atualizando status do veículo
                            _vehicle.set("status", "reject");
                            //atualizando contador de veículos da categoria
                            _cat.increment("counter", -1);
                            objects.push(_vehicle);
                            objects.push(_cat);
                            return Parse.Object.saveAll(objects, {useMasterKey: true});
                        }).then(function () {
                            return PushNotification.sendPushToUsers(_owner.id, Messages(_owner.get("language") || null).push.rejectVehicle, Define.pushTypes.userVehicleRejected, "driver");
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            setPrimaryVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["vehicleId"], _response)) {
                        let promise, _vehicle, _owner;
                        //verificando parâmetro driverId
                        if (_params.driverId) {
                            let qUser = new Parse.Query(Parse.User);
                            promise = qUser.get(_params.driverId);
                        } else
                            promise = Promise.resolve(undefined);

                        return promise.then(function (driver) {
                            _owner = driver || _currentUser;
                            let qVehicle = new Parse.Query(Define.Vehicle);
                            return qVehicle.get(_params.vehicleId);
                        }).then(function (vehicle) {
                            _vehicle = vehicle;
                            //verificando se o veículo está aprovado
                            if (_vehicle.get("status") && _vehicle.get("status") !== "approved" && _vehicle.get("optional"))
                                return Promise.reject(Messages(_language).error.ERROR_VEHICLE_WAITING_APPROVAL);
                            //verificando dono do véiculo
                            if (_vehicle.get("user") && _vehicle.get("user").id !== _owner.id)
                                return Promise.reject(Messages(_language).error.ERROR_OWNER_VEHICLE);
                            //verificando se veículo já é o principal
                            if (_vehicle.get("primary"))
                                return Promise.reject(Messages(_language).error.ERROR_VEHICLE_ALREADY_PRIMARY);
                            //buscando antigo véiculo principal
                            return utils.findObject(Define.Vehicle, {
                                "user": _owner,
                                "primary": true,
                            }, false, null);
                        }).then(function (oldVehicles) {
                            if (oldVehicles.length > 0) {
                                let objects = [];
                                for (let i in oldVehicles) {
                                    oldVehicles[i].set("primary", false);
                                    objects.push(oldVehicles[i]);
                                }
                                return Parse.Object.saveAll(objects, {useMasterKey: true});
                            }
                            return Promise.resolve();
                        }).then(function () {
                            //tornando véiculo primary
                            _vehicle.set("primary", true);
                            return _vehicle.save(null, {useMasterKey: true});
                        }).then(function () {
                            return UserClass.instance().updateUserInFirebase(_vehicle.get("user"), false, false);
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },

            getVehicleByIdAsAdmin: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ['vehicleId'], _response)) {
                            const fields = ["category", "crlv", "user", "category.name", "crlv.link", "user.name", "user.profileImage", "primary", "status", "brand", "color", "model", "plate", "year"];
                            let output = {};
                            const vehicle = await utils.getObjectById(_params.vehicleId, Define.Vehicle, fields, {deleted: false});
                            output = _super.formatVehicle(vehicle);
                            const document = await utils.findObject(Define.Document, {name: "CRLV"}, []);
                            output.documentId = document ? document.id : null;
                          return _response.success(output);
                        }
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = Vehicle;
Parse.Cloud.beforeSave("Vehicle", async function (request) {
    await Vehicle(request).beforeSave();
});
Parse.Cloud.beforeDelete("Vehicle", async function (request) {
    await Vehicle(request).beforeDelete();
});
for (var key in Vehicle().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        if (conf.saveLocationInEndPoints)
            utils.saveUserLocation(request.params, request.user);
        return await Vehicle(request).publicMethods[request.functionName]();
    });
}
