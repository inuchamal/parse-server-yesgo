/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const Define = require("./Define.js");
const conf = require("config");
const utils = require("./Utils.js");
const cardType = ["mastercard", "visa", "elo", "amex", "discover", "aura", "jcb", "hipercard"];
const Messages = require('./Locales/Messages.js');
const UserClass = require('./User.js');
const PaymentModule = require('./Payment/Payment.js').instance();
const Mail = require('./mailTemplate.js');
const listFields = ["hash", "customerId", "paymentCustomerId", "language", "pagarmeId", "paymentId", "cpf", "number", "name", "token", "deleted", "date", "cvv", "brand", "owner", "numberCrip", "primary", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const listRequiredFields = [];
const response = require('./response');
function Card(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let language = object.get("language");
            object.unset("language");
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
            if (object.get("name")) object.set("name", object.get("name").toUpperCase().trim());

            if (object.isNew()) {
                object.set("deleted", false);
                let query = new Parse.Query(Define.Card);
                query.equalTo("owner", object.get("owner"));
                query.equalTo("primary", true);
                query.equalTo("deleted", false);
                return query.count().then(function (count) {
                    if (count == 0) {
                        object.set("primary", true);
                    }
                    let query = new Parse.Query(Define.Card);
                    query.equalTo("owner", object.get("owner"));
                    query.equalTo("numberCrip", object.get("numberCrip"));
                    query.equalTo("deleted", false);
                    return query.count().then(function (count) {
                        if (count == 0) {
                            return _response.success();
                        } else {
                            _response.error(Messages(language).error.ERROR_CARD_EXITS.code, Messages(language).error.ERROR_CARD_EXITS.message);
                        }
                    });
                });
            } else {
                return _response.success();
            }
        },
        beforeDelete: function () {
            let object = _request.object;
            if (request.master) {
                if (object.get("primary")) {
                    return utils.findObject(Define.Card, {"owner": object.get("owner")}, false, null, null, null, null, {"objectId": object.id}).then(function (cards) {
                        for (let i = 0; i < cards.length; i++) {
                            cards[i].set("primary", false); //just in case
                        }
                        if (cards.length > 0) {
                            cards[0].set("primary", true);
                        }
                        return Parse.Object.saveAll(cards);
                    }).then(function () {
                        return _response.success();
                    })
                } else return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        saveCard: function (hash, id, paymentCustomerId, numberCrip, brand, user) {
            let card = new Define.Card();
            card.set("paymentId", id.toString());
            card.set("paymentCustomerId", paymentCustomerId.toString());
            card.set("owner", user);
            card.set("primary", false);
            card.set("numberCrip", numberCrip);
            card.set("brand", brand);
            card.set("language", user.get("language"));
            card.set("hash", hash);
            // card.set("number", number);
            // card.set("name", name);
            // card.set("date", date);
            // card.set("cvv", cvv);
            // card.set("cpf", cpf);
            // card.set("token", token);
            return card.save();
        },
        unselectOtherCards: function (user, id) {
            let query = new Parse.Query(Define.Card);
            query.equalTo("owner", user);
            query.equalTo("primary", true);
            query.notEqualTo("objectId", id);
            return query.find().then(function (cards) {
                for (let i = 0; i < cards.length; i++) {
                    cards[i].set("primary", false);
                }
                return Parse.Object.saveAll(cards);
            });
        },
        createCardCustomer: function (_params, user) {
            let name = UserClass.instance().formatNameToPayment(user);
            return PaymentModule.createCustomer(user.id, name, user.get("email"), user.get("phone"), user.get("birthDate"), _params.cpf, null, user.get("isDriverApp")).then(function (pagarmeCustomer) {
                return user.save({paymentId: pagarmeCustomer.id.toString()}, {useMasterKey: true});
            }).then(function (newUser) {
                return _super.createCard(_params, newUser);
            });
        },
        createCard: async function (_params, user) {
            try {
                const card = await PaymentModule.createCard(_params.number, _params.name, _params.date.substring(0, 2), _params.date.substring(2, 4), _params.cvv, _params.brand, user.get("paymentId"), user.id, user.get("isDriverApp"))
                if (!card.valid)
                    throw Messages(user.get("language")).error.ERROR_CARD_INVALID
                const t = await _super.saveCard(_params.hash, card.id, card.customer.id, "**** **** **** " + card.last_digits, card.brand, _currentUser);
                return Promise.resolve(t)
            } catch (e) {
                throw e
            }
        },
        publicMethods: {
            listCards: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let _cards, objs = {};
                    let query = new Parse.Query(Define.Card);
                    query.equalTo("owner", _currentUser);
                    query.notEqualTo("deleted", true);
                    query.include("owner");
                    return (conf.payment && conf.payment.blockCardPayment ? Promise.resolve([]) : query.find()).then(function (cards) {
                        _cards = cards;
                        for (let i = 0; i < _cards.length; i++) {
                            objs[_cards[i].get("paymentId")] = {
                                objectId: _cards[i].id,
                                primary: _cards[i].get("primary"),
                            }
                        }
                        return _cards.length > 0 ? PaymentModule.listCards(_cards[0].get("paymentCustomerId"), _currentUser.id, _currentUser.get("isDriverApp")) : Promise.resolve(null);
                    }).then(function (cardsPagarme) {
                        let fakeCard = Define.fakeCard;
                        if (cardsPagarme !== null) {
                            for (let i = 0; i < cardsPagarme.length; i++) {
                                if (!objs[cardsPagarme[i].id]) {
                                    //card has already been removed from our db
                                    continue;
                                }
                                objs[cardsPagarme[i].id].brand = cardsPagarme[i].brand;
                                objs[cardsPagarme[i].id].name = cardsPagarme[i].holder_name ? cardsPagarme[i].holder_name.replace("undefined", "") : "holder";
                                objs[cardsPagarme[i].id].numberCrip = "**** **** **** " + cardsPagarme[i].last_digits;
                            }
                        }
                        let output = [];
                        for (let key in objs) {
                            output.push(objs[key]);
                        }
                        if (_currentUser.get("isPassenger") && !_currentUser.get("isDriverApp") ) {
                            if(conf.bonusLevel && conf.bonusLevel.type === 'yesgo'){
                                let cfakes = Define.yesFakeCard;
                                output = output.concat(Define.yesFakeCard);
                            } else {
                                fakeCard.name = (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "Bônus" : "";
                                fakeCard.numberCrip = "";
                                fakeCard.primary = !(_cards.length > 0);
                                output.push(fakeCard);
                            }
                        }
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listCardsByUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let _cards, _total, _user, objs = {};
                        let limit = _params.limit || 10;
                        let page = ((_params.page || 1) - 1) * limit;
                        let query = new Parse.Query(Define.Card);
                        let queryUser = new Parse.Query(Parse.User);
                        return queryUser.get(_params.userId).then(function (user) {
                            _user = user;
                            query.equalTo("owner", _user);
                            query.containedIn("deleted", [false, undefined]);
                            return query.count();
                        }).then(function (total) {
                            _total = total;
                            query.limit(limit);
                            query.skip(page);
                            query.include("owner");
                            return conf.payment && conf.payment.blockCardPayment ? Promise.resolve([]) : query.find();
                        }).then(function (cards) {
                            _cards = cards;
                            for (let i = 0; i < _cards.length; i++) {
                                objs[_cards[i].get("paymentId")] = {
                                    objectId: _cards[i].id,
                                    primary: _cards[i].get("primary"),
                                }
                            }
                            return _cards.length > 0 ? PaymentModule.listCards(_cards[0].get("paymentCustomerId"), _user.id, _user.get("isDriverApp")) : Promise.resolve(null);
                        }).then(function (cardsPagarme) {

                            if (cardsPagarme !== null) {
                                for (let i = 0; i < cardsPagarme.length; i++) {
                                    if (!objs[cardsPagarme[i].id]) {
                                        //card has already been removed from our db
                                        continue;
                                    }
                                    objs[cardsPagarme[i].id].brand = cardsPagarme[i].brand;
                                    objs[cardsPagarme[i].id].name = cardsPagarme[i].holder_name.replace("undefined", "");
                                    objs[cardsPagarme[i].id].numberCrip = "**** **** **** " + cardsPagarme[i].last_digits;
                                }
                            }
                            let output = [];
                            for (let key in objs) {
                                output.push(objs[key]);
                            }

                            return _response.success({total: _total, cards: output});
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },

            setPrimaryCard: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        let queryCard = new Parse.Query(Define.Card);
                        queryCard.equalTo("owner", _currentUser);
                        return queryCard.get(_params.objectId).then(function (card) {
                            card.set("primary", true);
                            return card.save();
                        }).then(function (cardSaved) {
                            return _super.unselectOtherCards(_currentUser, cardSaved.id);
                        }).then(function () {
                            return _response.success(true);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });}
                }
            },
            createCard: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["number", "name", "date", "cvv", "brand", "cpf"], _response)) {
                        let firstDate = parseInt(_params.date.substring(0, 2));
                        let endDate = parseInt(_params.date.substring(2));
                        return utils.countObject(Define.Card, {
                            "owner": _currentUser,
                            "deleted": false
                        }).then(function (count) {
                            if (conf.payment && conf.payment.blockCardPayment) {
                                return Promise.reject(Messages(_language).error.ERROR_BLOCK_CARD_CREATION);

                            }
                            if (count >= 5) {
                                return Promise.reject(Messages(_language).error.ERROR_CARD_LIMIT);
                            }
                            if (_params.date.length != 4 || firstDate > 12 || endDate < 0 || endDate < 17) {
                                return Promise.reject(Messages(_language).error.ERROR_INVALID_DATE);
                            }
                            _params.brand = _params.brand.toLowerCase();
                            if (cardType.indexOf(_params.brand) < 0) {
                                return Promise.reject(Messages(_language).error.ERROR_INVALID_BRAND);
                            }
                            _params.cpf = _params.cpf.replace(/\D/g, '');
                            _params.number = _params.number.replace(/\D/g, '');

                            _params.hash = utils.encrypt(JSON.stringify({
                                name: _params.name,
                                number: _params.number,
                                date: _params.date,
                                cvv: _params.cvv,
                                brand: _params.brand
                            }));
                            return _super[_currentUser.get("paymentId") ? "createCard" : "createCardCustomer"](_params, _currentUser)
                        }).then(function (newCard) {
                            return _response.success({objectId: newCard.id});
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            deleteCard: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return utils.getObjectById(_params.objectId, Define.Card, "owner", {"owner": _currentUser}).then(function (card) {
                            card.set("deleted", true);
                            return card.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _response.success(true);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getPrimaryCard: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let _card;
                    let query = new Parse.Query(Define.Card);
                    query.equalTo("owner", _currentUser);
                    query.equalTo("primary", true);
                    query.equalTo("deleted", false);
                    query.exists("paymentId");
                    return (conf.payment && conf.payment.blockCardPayment ? Promise.resolve(null) : query.first()).then(function (card) {
                        _card = card;
                        return _card ? PaymentModule.getCard(card.get("paymentId")) : Promise.resolve(null);
                    }).then(function (cardPagarme) {
                        let obj = {};
                        if (cardPagarme !== null) {
                            obj = {
                                objectId: _card.id,
                                brand: cardPagarme.brand,
                                name: cardPagarme.holder_name,
                                date: cardPagarme.expiration_date,
                                numberCrip: "**** **** **** " + cardPagarme.last_digits
                            }
                        } else if (_currentUser.get("isPassenger")) {
                            obj = Define.fakeCard;
                            obj.name = (conf.bonusLevel && conf.bonusLevel.verifyValueOfBonusToUseInTravel) ? "Bônus" : "Dinheiro";
                            obj.brand = "";
                            obj.numberCrip = "";
                        }
                        // _response.success(utils.formatPFObjectInJson(card, listFields));
                        return _response.success(obj);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            }
        }
    }
    return _super;
}

exports.instance = Card;
Parse.Cloud.beforeSave("Card", async function (request) {
    await Card(request).beforeSave();
});
Parse.Cloud.beforeDelete("Card", async function (request) {
    await Card(request).beforeDelete();
});
for (let key in Card().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Card(request).publicMethods[request.functionName]();
    });
}
