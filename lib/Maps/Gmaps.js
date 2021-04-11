'use strict';
const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const URL_BASE = "https://maps.googleapis.com/maps/api";
const Fare = require('../Fare').instance();
let mapTokens = {};
'use strict';
const response = require('../response');
function GMaps(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        MODE: {
            TRANSIT: "transit",
            DRIVING: "driving",
            WALKING: "walking",
            BIKE: "cycling",
        },
        makeRequest: function (url) {
            url = utils.cleanStringUTF8(utils.removeDiacritics(url));
            return Parse.Cloud.httpRequest({url: url}).then(function (httpResponse) {
                if (httpResponse.data && httpResponse.data.error_message)
                    return Promise.reject(httpResponse.data.error_message);
                return Promise.resolve(httpResponse.data);
            }, function error(error) {
                console.log("request error", error)
                return Promise.reject(error);
            });
        },
        getRoute: function (originLat, originLng, destinyLat, destinyLng) {
            let url = URL_BASE + "/directions/json?sensor=false";
            url += "&origin=" + originLat + "," + originLng;
            url += "&destination=" + destinyLat + "," + destinyLng;
            url += "&key=" + Define.MapsKey;
            url += "&mode=" + _super.MODE.DRIVING;
            return _super.makeRequest(url);
        },
        getDistanceBetweenPoints: async (originLat, originLng, destLat, destLng, attempt) => {
            try {
                let route = await _super.getRoute(originLat, originLng, destLat, destLng)
                return Promise.resolve({
                    distance: route.routes[0].legs[0].distance.value / 1000,
                    time: route.routes[0].legs[0].duration.value
                });
            } catch (e) {
                return Promise.reject(e)
            }

        },
        requestAutocompletePlaces: function ({text, latitude, longitude, searchRadius, sessionToken, cityOnly}) {
            text = utils.removeDiacritics(text);
            searchRadius = searchRadius || 100;
            let urlString = URL_BASE + "/place/autocomplete/json?";
            urlString += "input=" + text + "&sessiontoken=" + sessionToken;
            if (latitude && longitude)
                urlString += "&location=" + latitude + "," + longitude;
            urlString += "&radius=" + searchRadius;
            if (cityOnly) urlString += "&types=(cities)";
            urlString += "&key=" + Define.MapsKey;
            return _super.makeRequest(urlString);
        },
        formatAddressComponent: function (data) {
            let address_components = data.address_components;
            let json = {
                latitude: data.geometry.location.lat,
                longitude: data.geometry.location.lng,
                number: null,
                address: null,
                neighborhood: null,
                city: null,
                state: null,
                zip: null
            }, countFields = 0;
            for (let j = 0; j < address_components.length; j++) {
                let types = address_components[j].types;
                for (let k = 0; k < types.length; k++) {
                    if (!json.number && types[k] == "street_number") {
                        json.number = address_components[j].long_name;
                        countFields++;
                    }
                    if (!json.address && (types[k] == "route" || types[k] == "street_address")) {
                        json.address = address_components[j].long_name;
                        countFields++;
                    }
                    if (!json.neighborhood && types[k] == "sublocality_level_1") {
                        json.neighborhood = address_components[j].long_name;
                        countFields++;
                    }
                    if (!json.city && (types[k] == "administrative_area_level_2" || types[k] == "locality")) {
                        json.city = address_components[j].long_name;
                        countFields++;
                    }
                    if (!json.state && types[k] == "administrative_area_level_1") {
                        json.state = address_components[j].long_name;
                        countFields++;
                    }
                    if (!json.zip && types[k] == "postal_code") {
                        json.zip = address_components[j].long_name;
                        countFields++;
                    }
                    if (countFields == 6) return Promise.resolve(json);
                }
            }
            return Promise.resolve(json);
        },
        getPlaceInfoByPlaceId: function (placeId) {
            let objectPlace;
            return require("./CacheDB/CachePlace").search(placeId).then(function (result) {
                if (result) {
                    objectPlace = result;
                    return Promise.resolve(result.get("details"));
                }
                let urlString = URL_BASE + "/place/details/json?fields=name,address_components,geometry";
                urlString += "&key=" + Define.MapsKey;
                urlString += "&placeid=" + placeId;
                // console.log("--- getPlaceInfoByPlaceId");
                return _super.makeRequest(urlString).then(function (data) {
                    if (data && data.error_message) {
                        console.log(data.error_message);
                    }
                    return _super.formatAddressComponent(data.result);
                });
            }).then(function (details) {
                return require("./CacheDB/CachePlace").save(placeId, details, objectPlace);
            });
        },
        getPlaceInfoByLatLng: function (lat, lng) {
            if (!lat || !lng) return Promise.resolve({});
            let objectPlace;
            return require("./CacheDB/CacheGeocoding").search(lat, lng).then(function (result) {
                if (result) {
                    objectPlace = result;
                    return Promise.resolve(result.get("address"));
                }
                let urlString = URL_BASE + "/geocode/json?sensor=true&key=" + Define.MapsKey;
                urlString += "&latlng=" + lat + "," + lng;
                return _super.makeRequest(urlString).then(function (data) {
                    if (data && data.error_message) {
                        console.log(data.error_message);
                    }
                    return _super.formatAddressComponent(data.results[0]);
                });
            }).then(function (address) {
                return require("./CacheDB/CacheGeocoding").save(lat, lng, address, objectPlace);
            });

        },
        autocompletePlaces: function () {
            let promise;
            let minLength = conf.maps && conf.maps.minCharacter ? conf.maps.minCharacter : undefined;
            if (!minLength || _params.text.trim().length >= minLength) {
                if (!minLength && !mapTokens["_currentUser.id"])
                    mapTokens["_currentUser.id"] = utils.UUID();
                promise = _super.requestAutocompletePlaces({
                    text: _params.text,
                    latitude: _params.latitude,
                    searchRadius: _params.searchRadius,
                    longitude: _params.longitude,
                    sessionToken: mapTokens["_currentUser.id"]
                });
            } else
                promise = Promise.resolve({predictions: []})
            return promise.then(function (data) {
                let places = {predictions: []};
                data = data.predictions;
                for (let i = 0; i < data.length; i++) {
                    delete data[i].structured_formatting.main_text_matched_substrings;
                    places.predictions.push({
                        place_id: data[i].place_id,
                        structured_formatting: data[i].structured_formatting,
                    });
                }
                return Promise.resolve(places);
            });
        },
        recoverInfo: function (placeId, lat, lng) {
            return placeId ? _super.getPlaceInfoByPlaceId(placeId) : _super.getPlaceInfoByLatLng(lat, lng);
        },
        makePartialRoute: async (originPlaceId, originLat, originLng, destinyPlaceId, destinyLat, destinyLng, ignoreRoute) => {
            try {
                let promises = [], route = {origin: {}, destiny: {}};
                promises.push(_super.recoverInfo(originPlaceId, originLat, originLng));
                promises.push(_super.recoverInfo(destinyPlaceId, destinyLat, destinyLng));
                let resultPromises = await Promise.all(promises);
                if (_currentUser) delete mapTokens[_currentUser.id];
                route.origin.info = resultPromises[0];
                route.destiny.info = resultPromises[1];
                let promise = ignoreRoute ? Promise.resolve() : _super.getRoute(route.origin.info.latitude, route.origin.info.longitude, route.destiny.info.latitude, route.destiny.info.longitude);
                let data = await promise;
                if (!ignoreRoute && data.routes[0]) {
                    route.origin.coordinates = data.routes[0].legs[0].start_location;
                    route.destiny.coordinates = data.routes[0].legs[0].end_location;
                    route.distance = data.routes[0].legs[0].distance.value;
                    route.duration = data.routes[0].legs[0].duration.value;
                    route.polyline = data.routes[0].overview_polyline.points;
                }
                return route;
            } catch (e) {
                console.log(e);
            }
        },
        publicMethods: {
            autocompleteCities: function () {
                if (utils.verifyRequiredFields(_params, ["text"], _response)) {
                    let promise;
                    let minLength = conf.maps && conf.maps.minCharacter ? conf.maps.minCharacter : undefined;
                    if (!minLength || _params.text.trim().length >= minLength) {
                        if (!minLength && !mapTokens["_currentUser.id"])
                            mapTokens["_currentUser.id"] = utils.UUID();
                        promise = _super.requestAutocompletePlaces({
                            text: _params.text,
                            latitude: _params.latitude,
                            searchRadius: _params.searchRadius,
                            longitude: _params.longitude,
                            sessionToken: mapTokens["_currentUser.id"],
                            cityOnly: true
                        });
                    } else
                        promise = Promise.resolve({predictions: []})
                    return promise.then(function (data) {
                        let places = [];
                        data = data.predictions;
                        for (let i = 0; i < data.length; i++) {
                            delete data[i].structured_formatting.main_text_matched_substrings;
                            places.push(data[i].structured_formatting.main_text);
                        }
                      return _response.success(places);
                    }, function (error) {
                        _response.error(error);
                    });
                }
            },
            getPlaceInformations: function () {
                if (utils.verifyRequiredFields(_params, ["latitude", "longitude"], _response)) {
                    return _super.getPlaceInfoByLatLng(_params.latitude, _params.longitude).then(function (data) {
                      return _response.success(data);
                    }, function (error) {
                        _response.error(error);
                    });
                }
            },
            getRouteMultiplePoints: async () => {
                try {
                    let response = {routes: [], totalTime: 0, totalDistance: 0};
                    if (utils.verifyRequiredFields(_params, ["points"], _response)) {
                        for (let i = 0; i < _params.points.length - 1; i++) {
                            let point = _params.points[i];
                            let nextPoint = _params.points[i + 1];
                            if ((!point.address.location && !point.address.placeId) || (!nextPoint.address.location && !nextPoint.address.placeId))
                                return _response.error(Messages(_language).error.ERROR_LOCATION_OR_PLACEID.code, Messages(_language).error.ERROR_LOCATION_OR_PLACEID.message);
                            let data = await _super.makePartialRoute(
                                point.address.placeId,
                                point.address.location ? point.address.location.latitude : null,
                                point.address.location ? point.address.location.longitude : null,
                                nextPoint.address.placeId,
                                nextPoint.address.location ? nextPoint.address.location.latitude : null,
                                nextPoint.address.location ? nextPoint.address.location.longitude : null,
                                _params.ignoreRoute
                            );

                            response.totalTime += data.duration
                            response.totalDistance += data.distance
                            response.routes.push(data);
                        }
                        if (_params.travelId) {
                            let travel = await utils.getObjectById(_params.travelId, Define.Travel, ['fare', 'couponRelation'])
                            let value = Fare.calculateValue(travel.get('fare'), response.totalDistance / 1000, response.totalTime / 60, _currentUser)
                            if (travel.get("couponRelation")) {
                                let newValues = CouponInstance.calculateDiscount(travel.get("couponRelation"), value);
                                value = newValues.value;
                            }
                            response.value = value;
                        }
                      return _response.success(response)
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }

            },
            getRoute: function () {
                if (!_params.originPlaceId && (!_params.originLat || !_params.originLng))
                // return _response.error(400, "É obrigatório enviar 'originPlaceId' ou 'originLat' e 'originLng'");
                    return _response.error(Messages(_language).error.ERROR_GPS_INVALID.code, Messages(_language).error.ERROR_GPS_INVALID.message);
                if (!_params.destinyPlaceId && (!_params.destinyLat || !_params.destinyLng))
                    return _response.error(Messages(_language).error.ERROR_GPS_INVALID.code, Messages(_language).error.ERROR_GPS_INVALID.message);
                // return _response.error(400, "É obrigatório enviar 'originPlaceId' ou 'originLat' e 'originLng'");
                let promises = [], route = {origin: {}, destiny: {}};
                promises.push(_super.recoverInfo(_params.originPlaceId, _params.originLat, _params.originLng));
                promises.push(_super.recoverInfo(_params.destinyPlaceId, _params.destinyLat, _params.destinyLng));
                return Promise.all(promises).then(function (resultPromises) {
                    if (_currentUser) delete mapTokens[_currentUser.id];
                    route.origin.info = resultPromises[0];
                    route.destiny.info = resultPromises[1];
                    return _params.ignoreRoute ? Promise.resolve() : _super.getRoute(route.origin.info.latitude, route.origin.info.longitude, route.destiny.info.latitude, route.destiny.info.longitude);
                }).then(function (data) {
                    if (!_params.ignoreRoute) {
                        route.origin.coordinates = data.routes[0].legs[0].start_location;
                        route.destiny.coordinates = data.routes[0].legs[0].end_location;
                        route.steps = data.routes[0].legs[0].steps;
                        route.distance = data.routes[0].legs[0].distance.value;
                        route.duration = data.routes[0].legs[0].duration.value;
                        route.polyline = data.routes[0].overview_polyline.points;
                    }
                  return _response.success(route);
                }, function (error) {
                    _response.error(error);
                });
            }
        }
    };
    return _super;
}

exports.instance = GMaps;
for (var key in GMaps().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await GMaps(request).publicMethods[request.functionName]();
    });
}
