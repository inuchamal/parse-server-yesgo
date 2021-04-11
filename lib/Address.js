/**
 * Created by Patrick on 08/08/2017.
 */
const response = require('./response');
'use strict';
const Define = require("./Define.js");
const utils = require("./Utils.js");
const ConfigInstance = require('./Config.js').instance();
const conf = require("config");
const cardType = ["master", "visa", "other"];
const Messages = require('./Locales/Messages.js');
const Mail = require('./mailTemplate.js');
const listFields = ["user", "address", "placeId", "number", 'complement', "favorite", "neighborhood", "city", "state", "zip", "deleted", "location", "updatedAt", "authData", "createdAt", "objectId", "ACL"];
const listRequiredFields = [];

function Address(request) {
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
        getAddressById: function (id, user) {
            let query = new Parse.Query(Define.Address);
            if (user) {
                query.equalTo("user", user);
            }
            return query.get(id);
        },
        verifyFieldsToCreateAddress: function (street, lat, lng) {
            if (street) return Promise.resolve({street: street});
            return utils.getLocationInformation(lat, lng);

        },
        formatAddressToPayment: function (addressJson, address) {
            return {
                "country": "br",
                "state": addressJson ? addressJson.state : address.get("state"),
                "city": addressJson ? addressJson.city : address.get("city"),
                "street": addressJson ? addressJson.street : address.get("street"),
                "street_number": addressJson ? addressJson.number : address.get("number"),
                "zipcode": ((addressJson ? addressJson.zip : address.get("zip")) || "").replace(/\D/g, '')
            }
        },
        formatAddressToTravelDetails: function (addressJson, address) {
            let json;
            return (addressJson) ? {
                fullAddress: (addressJson.address || "") + " " + (addressJson.number || "") + " " + (addressJson.complement || ""),
                neighborhood: addressJson.neighborhood,
                city: addressJson.city,
                state: addressJson.state,
                location: addressJson.location
            } : {
                fullAddress: !address ? "" : address.get("address") || "" + " " + address.get("number") || "" + " " + address.get("complement") || "",
                neighborhood: address ? address.get("neighborhood") : "",
                city: address ? address.get("city") : "",
                state: address ? address.get("state") : "",
                location: !address ? "" : address.get("location")
            };
        },
        createAddress: function (type, id, user, street, lat, lng, number, complement, neighborhood, city, state, zip, favorite, placeId) {
            if (zip) zip = zip.replace(/\D/g, '');
            if (id) {
                return _super.getAddressById(id).then(function (address) {
                    let json = {
                        "type": type,
                        "address": address.get("address"),
                        "city": address.get("city"),
                        "state": address.get("state"),
                        "zip": address.get("zip"),
                        "favorite": address.get("favorite") || false,
                        "location": address.get("location")
                    };
                    if (placeId)
                        json.placeId = address.get("placeId");
                    if (neighborhood)
                        json.neighborhood = address.get("neighborhood");
                    if (complement)
                        json.complement = address.get("complement");
                    if (number)
                        json.number = address.get("number");
                    return Promise.resolve(json);
                })
            } else {
                return _super.verifyFieldsToCreateAddress(street, lat, lng).then(function (data) {
                    if (!street && data.street && street !== data.street) street = data.street;
                    if (!number && data.number && street != data.number) number = data.number;
                    if (!street || !lat || !lng || !state) {
                        return Promise.reject({message: "Missing fields to create address"});
                    }
                    let json = {
                        "type": type,
                        "address": street,
                        "city": city || "",
                        "state": state,
                        "zip": zip,
                        "favorite": favorite || false,
                        "location": new Parse.GeoPoint({
                            latitude: parseFloat(lat),
                            longitude: parseFloat(lng)
                        })
                    };
                    if (placeId)
                        json.placeId = placeId;
                    if (neighborhood)
                        json.neighborhood = neighborhood;
                    if (complement)
                        json.complement = complement;
                    if (number)
                        json.number = number;
                    return Promise.resolve(json);
                })
            }
        },
        generateKeyAddress: ({address, city, state, zip, number}) => {
            return (address + city + state + zip + (number || "")).toLowerCase().replace(/\s/g, '');
        },
        publicMethods: {
            saveAddress: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["address", "latitude", "longitude", "city", "state", "zip"], _response)) {
                        return _super.createAddress(null, _currentUser, _params.address, _params.latitude, _params.longitude, _params.number, _params.complement, _params.neighborhood, _params.city, _params.state, _params.zip, true, _params.placeId).then(function (addressSaved) {
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listAddresses: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    let query = new Parse.Query(Define.Address);
                    query.ascending("address");
                    query.equalTo("user", _currentUser);
                    query.equalTo("favorite", true);
                    query.find().then(function (result) {
                        return _response.success(utils.formatObjectArrayToJson(result, ["address", "number", "complement", "neighborhood", "city", "state", "location"]));
                    });
                }
            },
            // listRecentAddressesOld: function () {
            //     if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
            //         let qConfig = new Parse.Query(Define.Config);
            //         qConfig.select(["numberOfRecentAddresses"]);
            //         return qConfig.first().then(function (config) {
            //             let query = new Parse.Query(Define.Travel);
            //             let type = _currentUser.get("isDriverApp") ? "driver" : "user";
            //             let limit = config.get("numberOfRecentAddresses") || 3;
            //             query.equalTo(type, _currentUser);
            //             query.descending("createdAt");
            //             query.equalTo("status", "completed");
            //             query.limit(limit);
            //             query.include(["destination"]);
            //             query.select(["destination", "destinationJson"]);
            //             return query.find();
            //         }).then(function (addresses) {
            //             let response = [];
            //             for (let i = 0; i < addresses.length; i++) {
            //                 response.push(addresses[i].get("destinationJson") || utils.formatObjectToJson(addresses[i].get("destination"), ["address", "number", "complement", "neighborhood", "city", "state", "location"]));
            //
            //             }
            //             return _response.success(response);
            //         });
            //     }
            // },
            listRecentAddresses: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    try {
                        const type = _currentUser.get("isDriverApp") ? "driver" : "user";
                        let config = await ConfigInstance.getNumberOfRecentAddresses();
                        let addresses = await utils.getTravelsTolistRecentAddresses(type,_currentUser);
                        let _limit = config.get("numberOfRecentAddresses") || 3;
                        let _output = [], _mapAddress = {};
                        for (let i = 0; i < addresses.length; i++) {
                            let destination = addresses[i].get("destinationJson") || utils.formatObjectToJson(addresses[i].get("destination"), ["address", "number", "complement", "neighborhood", "city", "state", "location"]);
                            let key = _super.generateKeyAddress(destination);
                                if (!_mapAddress[key])
                                _mapAddress[key] = destination;
                            if (Object.keys(_mapAddress).length === _limit)
                                break;
                        }
                        for (let key in _mapAddress)
                            _output.push(_mapAddress[key]);
                        return _response.success(_output);
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
                }
            },
            deleteAddress: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return _super.getAddressById(_params.objectId, _currentUser).then(function (result) {
                            return result.destroy({useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getAddressById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return _super.getAddressById(_params.objectId, _currentUser).then(function (result) {
                            return _response.success(utils.formatPFObjectInJson(result, ["address", "number", "complement", "neighborhood", "city", "state"]));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
        }
    }
    return _super;
}

exports.instance = Address;
Parse.Cloud.beforeSave("Address", async function (request) {
   await Address(request).beforeSave();
});
Parse.Cloud.beforeDelete("Address", async function (request) {
    await Address(request).beforeDelete();
});
for (let key in Address().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Address(request).publicMethods[request.functionName]();
    });
}
