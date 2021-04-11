'use strict';
const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const Mail = require('./mailTemplate.js');
const FirebaseInstance = require('./Firebase.js').instance();
const RedisJobInstance = require('./RedisJob.js').instance();
const PaymentInstance = require('./Payment/Payment.js').instance();
const UserClass = require('./User.js');
const Messages = require('./Locales/Messages.js');
const listFields = ["woman", "year", "driver", "type", "minCapacity", "maxCapacity", "icon", "active", "showPin", "name", "allows", "description", "description_en", "description_es", "counter", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "_email_verify_token", "emailVerified", "percentCompany"];
const typeFields = ["common", "vip", "taxi", "moto", "truck", "women", "bau"];
const listRequiredFields = [];

const moment = require('moment');

const response = require('./response');
function Category(request) {
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
                object.set("counter", 0);
            }
          return _response.success();
        },
        beforeDelete: function () {
            let object = _request.object;
            let promises = [];
            if (request.master) {
                return utils.findObject(Define.Vehicle, {"category": object}, true).then(function (vehicle) {
                    if (vehicle) return Promise.reject(Messages(_language).error.ERROR_CATEGORY_IN_USE);
                    else return utils.findObject(Define.Fare, {"category": object}, true)
                }).then(function (fare) {
                    if (fare) return Promise.reject(Messages(_language).error.ERROR_CATEGORY_IN_USE);
                    //procurando onde os allows e showPin tem referencia desta cat
                    let query = Parse.Query.or(
                        //,
                        new Parse.Query(Define.Category).containedIn("allows", [object]),
                        new Parse.Query(Define.Category).containedIn("showPin", [object])
                    );
                    return query.find();
                }).then(function (categorys) {
                    if (categorys.length > 0) {
                        for (let i = 0; i < categorys.length; i++) {
                            let allows = categorys[i].get("allows") || [];
                            let showPin = categorys[i].get("showPin") || [];

                            //retirando os allows
                            for (let j = 0; j < allows.length; j++) {
                                if (allows[j].id === object.id) {
                                    allows.splice(j, 1);
                                    break;
                                }
                            }
                            //retirando os showPin
                            for (let k = 0; k < showPin.length; k++) {
                                if (showPin[k].id === object.id) {
                                    showPin.splice(k, 1);
                                    break;
                                }
                            }

                            categorys[i].set("allows", allows);
                            categorys[i].set("showPin", showPin);
                            promises.push(categorys[i].save(null, {useMasterKey: true}));

                        }
                        return Promise.all(promises);
                    } else return Promise.resolve();
                }).then(function (results) {
                  return _response.success();
                }, function (error) {
                    _response.error(error.code, error.message);
                });
            } else {
                _response.error(Messages(_language).error.ERROR_UNAUTHORIZED);
            }

        },
        financeByCategory: async function (category, admin) {
            let queryVehicle = new Parse.Query(Define.Vehicle);
            queryVehicle.equalTo("category", category);

            let queryTravel = new Parse.Query(Define.Travel);
            queryTravel.limit(9999999);
            queryTravel.equalTo("status", "completed");
            queryTravel.matchesQuery("vehicle", queryVehicle);
            if (admin.get('admin_local')) {
                try {
                    const state = await utils.findObject(Define.State, {sigla: _currentUser.get('admin_local').state}, true);
                    queryTravel.equalTo('originJson.city', _currentUser.get('admin_local').city);
                    queryTravel.equalTo('originJson.state', state.get('name'))
                } catch (e) {
                    return Promise.reject(e)
                }
            }
            return queryTravel.find().then(function (travels) {
                let values = {
                    category: category.get("name"),
                    card: 0,
                    money: 0,
                    total: 0,
                    company: {card: 0, money: 0},
                    driver: {card: 0, money: 0}
                };
                for (let i = 0; i < travels.length; i++) {
                    let incrementField = travels[i].has("card") ? "card" : "money";
                    values[incrementField] += travels[i].get("value");
                    values.total += travels[i].get("value");
                    values.driver[incrementField] += travels[i].get("valueDriver");
                    values.company[incrementField] += (travels[i].get("planFee") || 0) + (travels[i].get("fee") || 0) + (travels[i].get("debitOfDriver") || 0);
                }
                values.total = parseFloat(values.total.toFixed(2));
                values.card = parseFloat(values.card.toFixed(2));
                values.money = parseFloat(values.money.toFixed(2));
                return Promise.resolve(values)
            });

        },
        updateRecipientDriversJob: async (id, data) => {
            let {objectId, percentCompany} = data;
            try {
                let qCategory = new Parse.Query(Define.Category);
                let qVehicles = new Parse.Query(Define.Vehicle);
                if (conf.customSplit) {
                    let uQuery = new Parse.Query(Parse.User);
                    uQuery.doesNotExist("customSplit");
                    qVehicles.matchesQuery("user", uQuery);
                }
                let promises = [];
                let category = await qCategory.get(objectId);
                qVehicles.equalTo("category", category);
                qVehicles.include("user");
                qVehicles.limit(1000000);
                let vehicles = await qVehicles.find();
                for (let i = 0; i < vehicles.length; i++) {
                    if (vehicles[i].get("user") && vehicles[i].get("user").get("recipientId"))
                        promises.push(PaymentInstance.updateRecipient({
                            userId: vehicles[i].get("user").id,
                            comission_percent: percentCompany
                        }));
                }
                await Promise.all(promises);
            } catch (e) {
                console.log("ERROR: ", e);
            }

        },
        formatCategory: (cat) => {

            let locale = _language || "pt"
            let description = cat.get("description") || undefined;
            if (conf.appIsMultilingual && locale !== "pt")
                description = cat.get("description_" + locale) || description;

            return {
                name: cat.get("name") || undefined,
                description,
                allows: cat.get("allows") || undefined,
                objectId: cat.id,
                year: cat.get("year") || moment().subtract(15, "years").format('YYYY')
            }
        },
        publicMethods: {
            createCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "description", "active", "year"], _response)) {
                        if (isNaN(parseInt(_params.year))) {
                            _response.error("Ano inválido!");
                            return;
                        }
                        //se o app for multilingue verificar se está enviando os campos name e descripiton
                        if (conf.appIsMultilingual && !_params.description_en) {
                            _response.error(Messages(_language).error.ERROR_CATEGORY_BILINGUAL_REQUIRED);
                        }
                        let promises = [], _allows, _newCat;
                        // verificando quais categorias tbm terão acesso a esta categoria
                        if (_params.allows) {
                            if (!Array.isArray(_params.allows))
                                return Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_ALLOW);

                            let allows = _params.allows;

                            for (let i = 0; i < allows.length; i++) {
                                let query = new Parse.Query(Define.Category);
                                promises.push(query.get(allows[i]));
                            }

                        } else
                            promises.push(Promise.resolve(undefined));

                        return Promise.all(promises).then(function (allows) {
                            _allows = allows;
                            let cat = new Define.Category();
                            if (_params.minCapacity != null) _params.minCapacity = parseInt(_params.minCapacity);
                            if (_params.maxCapacity != null) _params.maxCapacity = parseInt(_params.maxCapacity);
                            if (_params.percentCompany != null) _params.percentCompany = parseInt(_params.percentCompany);
                            _params.allows = allows;
                            return cat.save(_params);
                        }).then(function (newCat) {
                            promises = [];
                            _newCat = newCat;

                            if (_allows[0]) {
                                //salvando showPin
                                for (let i = 0; i < _allows.length; i++) {
                                    let showPin = [];
                                    let allows = _allows[i].get("showPin") || [];
                                    showPin.push(...allows, newCat);
                                    _allows[i].set("showPin", showPin);
                                    promises.push(_allows[i].save(null, {useMasterKey: true}));
                                }
                            } else
                                promises.push(Promise.resolve());
                        }).then(function (results) {
                            RedisJobInstance.addJob("Logger", "logCreateCategory", {
                                objectId: _newCat.id,
                                admin: _currentUser.id,
                                newInfo: _newCat
                            });
                            return _response.success({
                                objectId: _newCat.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            updateCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            delete _params.catId;
                            if (_params.minCapacity != null) _params.minCapacity = parseInt(_params.minCapacity);
                            if (_params.maxCapacity != null) _params.maxCapacity = parseInt(_params.maxCapacity);
                            return cat.save(_params);
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS)
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            addCategoryToVehicle: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        let _vehicle, _cat, _oldCat; //I need _oldCat to decrement counter of replaced category
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            _cat = cat;
                            return utils.findObject(Define.Vehicle, {
                                "user": _currentUser,
                                "primary": true
                            }, true, "user");
                        }).then(function (vehicle) {
                            _cat.increment("counter");
                            if (!vehicle) {
                                _vehicle = new Define.Vehicle();
                                _vehicle.set("user", _currentUser);
                                _vehicle.set("primary", true);
                                _vehicle.set("deleted", false);
                                _vehicle.set("status", "approved");
                            } else {
                                _vehicle = vehicle;
                                _oldCat = _vehicle.get("category");
                            }
                            _vehicle.set("category", _cat);
                            return Parse.Object.saveAll([_vehicle, _cat]);
                        }).then(function () {
                            //first time adding a category
                            if (_currentUser.get("profileStage") === Define.profileStage["4"]) {
                                _currentUser.set("profileStage", Define.profileStage["5"]);
                                return _currentUser.save(null, {useMasterKey: true});
                            } else {
                                if (_oldCat) {
                                    if (_oldCat.get("counter") > 0) {
                                        _oldCat.increment("counter", -1);
                                    } else {
                                        _oldCat.set("counter", 0);
                                    }
                                    return _oldCat.save();
                                } else return Promise.resolve();
                            }
                        }).then(function () {
                            return UserClass.instance().formatUser(_currentUser, true);
                        }).then(function (user) {
                            FirebaseInstance.updateUserInfo(user);
                          return _response.success(_currentUser.get("profileStage"));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            //lists only active categories
            listCategories: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    let query = new Parse.Query(Define.Category);
                    query.equalTo("active", true);
                    if (conf.woman_category && _currentUser.get('gender') === 'm') query.containedIn('woman', [false, undefined, null]);
                    return query.find().then(function (cats) {
                        let data = [];
                        for (let i in cats)
                            data.push(_super.formatCategory(cats[i]));
                        return _response.success(data);
                    })
                }
            },
            //admin
            listAllCategories: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || null;
                        const page = _params.page ? ((_params.page - 1 || 0) * limit) : null;
                        await utils.formatOrder(_params);
                        const matches = _params.search ? {name: _params.search} : {};
                        const cats = await utils.findObject(Define.Category, null, false, null, _params.ascendingBy, _params.descendingBy, null, null, limit, null, null, page, null, matches);
                        let promises = [];
                        let categories = utils.formatObjectArrayToJson(cats, ["woman", "name", "type", "minCapacity", "maxCapacity", "counter", "description", "year", "active", "percentCompany", "allows"]);
                        let vQuery;
                        for (let i = 0; i < cats.length; i++) {
                            let vehicle = await utils.findObject(Define.Vehicle, {"category": cats[i]}, true);
                            let fare = await utils.findObject(Define.Fare, {"category": cats[i]}, true);
                            categories[i].canDelete = !vehicle && !fare;
                            vQuery = new Parse.Query(Define.Vehicle);
                            vQuery.equalTo('category', cats[i]);
                            vQuery.equalTo('primary', true);
                            categories[i].counter = await vQuery.count();
                        }
                        return _response.success(categories);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            activateCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            cat.set('active', true);
                            return cat.save(null, {useMasterKey: _currentUser.get("isAdmin")});
                        }).then(function (cat) {
                            RedisJobInstance.addJob("Logger", "logActivateCategory", {
                                objectId: cat.id,
                                admin: _currentUser.id
                            });
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            deactivateCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            cat.set('active', false);
                            return cat.save(null, {useMasterKey: _currentUser.get("isAdmin")});
                        }).then(function (cat) {
                            RedisJobInstance.addJob("Logger", "logDeactivateCategory", {
                                objectId: cat.id,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        let promises = [], _allows, _cat, _oldInfo, _newInfo;
                        let _oldPercentCompany, _wasUpdateInPercentCompany;
                        return utils.getObjectById(_params.catId, Define.Category, "allows").then(function (cat) {
                            _cat = cat;
                            _oldPercentCompany = cat.get("percentCompany") || (conf.payment.iugu ? conf.payment.iugu.comission_percent : undefined) || undefined;
                            _oldInfo = cat.toJSON();
                            // verificando quais categorias tbm terão acesso a esta categoria
                            if (_params.allows) {
                                if (!Array.isArray(_params.allows))
                                    return Promise.reject(Messages(_language).error.ERROR_INVALID_FIELDS_ALLOW);

                                let allows = _params.allows;

                                for (let i = 0; i < allows.length; i++) {
                                    let query = new Parse.Query(Define.Category);
                                    promises.push(query.get(allows[i]));
                                }
                                return Promise.all(promises);

                            } else
                                return Promise.resolve(undefined);

                        }).then(function (allows) {
                            _allows = allows;
                            delete _params.catId;

                            if (_params.minCapacity != null) _params.minCapacity = parseInt(_params.minCapacity);
                            if (_params.maxCapacity != null) _params.maxCapacity = parseInt(_params.maxCapacity);
                            if (_params.percentCompany != null) {
                                _params.percentCompany = parseFloat(_params.percentCompany);
                                if (_oldPercentCompany)
                                    _wasUpdateInPercentCompany = _oldPercentCompany !== _params.percentCompany;
                                else
                                    _wasUpdateInPercentCompany = false;
                            }
                            //se existi allows
                            if (_allows)
                                _params.allows = _allows;
                            return _cat.save(_params);
                        }).then(function (cat) {
                            _cat = cat;
                            _newInfo = cat.toJSON();
                            // se existe allows
                            if (_allows) {
                                //atualizando showPin
                                let query = new Parse.Query(Define.Category);
                                let ids = [_cat.id];
                                for (let i = 0; i < _allows.length; i++)
                                    ids.push(_allows[i].id);
                                query.notContainedIn("objectId", ids);
                                query.select(["showPin"]);
                                return query.find();
                            } else
                                return Promise.resolve([]);
                        }).then(function (categorys) {
                            promises = [];
                            let showPin;
                            if (categorys.length > 0) {
                                //removendo showPin
                                for (let i = 0; i < categorys.length; i++) {
                                    showPin = categorys[i].get("showPin") || [];

                                    //comparando showPin com categoria editada
                                    for (let j = 0; j < showPin.length; j++) {
                                        if (showPin[j].id === _cat.id) {
                                            showPin.splice(j, 1);
                                            break;
                                        }
                                    }


                                    categorys[i].set("showPin", showPin);
                                    promises.push(categorys[i].save(null, {useMasterKey: true}));
                                }
                                return Promise.all(promises);
                            } else
                                return Promise.resolve();
                        }).then(function () {
                            promises = [];
                            if (_allows) {
                                for (let i = 0; i < _allows.length; i++) {
                                    _allows[i].addUnique("showPin", _cat);
                                    promises.push(_allows[i].save(null, {useMasterKey: true}));
                                }
                                return Promise.all(promises);
                            } else
                                return Promise.resolve();
                        }).then(function () {
                            if (!conf.usePlan && _wasUpdateInPercentCompany && conf.payment.module === "iugu")
                                RedisJobInstance.addJob("Category", "updateRecipientDriversJob", {
                                    objectId: _cat.id,
                                    percentCompany: _params.percentCompany
                                });


                            RedisJobInstance.addJob("Logger", "logEditCategory", {
                                objectId: _cat.id,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: _newInfo
                            });

                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });

                    }
                }
            },
            deleteCategory: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["catId"], _response)) {
                        let promises = [], _cat;
                        return utils.getObjectById(_params.catId, Define.Category).then(function (cat) {
                            _cat = {
                                name: cat.get("name"),
                                description: cat.get("description"),
                                type: cat.get("type")
                            };
                            return cat.destroy({useMasterKey: true});
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logDeleteCategory", {
                                objectId: _params.catId,
                                admin: _currentUser.id,
                                oldInfo: _cat
                            });
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            financeByCategories: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    return utils.findObject(Define.Category).then(function (categories) {
                        let promises = [];
                        for (let i = 0; i < categories.length; i++) {
                            promises.push(_super.financeByCategory(categories[i], _currentUser));
                        }
                        return Promise.all(promises);
                    }).then(function (result) {
                        let output = {
                            categories: [], resume: {
                                company: {card: 0, money: 0},
                                driver: {card: 0, money: 0}
                            }
                        };
                        for (let i = 0; i < result.length; i++) {
                            output.categories.push(result[i]);
                            output.resume.company.card += result[i].company.card;
                            output.resume.company.money += result[i].company.money;
                            output.resume.driver.card += result[i].driver.card;
                            output.resume.driver.money += result[i].driver.money;
                        }
                        output.resume.company.card = parseFloat(output.resume.company.card.toFixed(2));
                        output.resume.company.money = parseFloat(output.resume.company.money.toFixed(2));
                        output.resume.driver.card = parseFloat(output.resume.driver.card.toFixed(2));
                        output.resume.driver.money = parseFloat(output.resume.driver.money.toFixed(2));
                      return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            getCategoryById: async function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    if (utils.verifyRequiredFields(_params, ['categoryId'], _response)) {
                        const fields = ["name", "type", "minCapacity", "maxCapacity", "counter", "description", "year", "active", "percentCompany", "icon", "woman"];
                        let output = {};
                        try {
                            const category = await utils.getObjectById(_params.categoryId, Define.Category, fields);
                            output = utils.formatObjectToJson(category, fields);
                            output.allows = [];
                            if(category.get("allows")){
                                let al;
                                for (let i = 0; i < category.get("allows").length; i++) {
                                    al = await utils.getObjectById(category.get("allows")[i].id, Define.Category, ["name"]);
                                    output.allows.push({objectId: al.id, name: al.get("name")});
                                }
                                output.allows.sort(function (a, b) {
                                    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                                });
                            }
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

exports.instance = Category;

/* CALLBACKS */
Parse.Cloud.beforeSave("Category", async function (request) {
    await Category(request).beforeSave();
});
Parse.Cloud.beforeDelete("Category", async function (request) {
    await Category(request).beforeDelete();
});
for (let key in Category().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Category(request).publicMethods[request.functionName]();
    });
}
