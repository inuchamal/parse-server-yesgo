'use strict';
const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const URL_BASE = "https://api.mapbox.com";
let mapTokens = {};
'use strict';
const token = conf.maps.mapbox.token;
const response = require('../response');
function Mapbox(request) {
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
            url = utils.removeDiacritics(url);
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

            let url = URL_BASE + "/directions/v5/mapbox/driving/";
            url += originLng + "," + originLat + ";";
            url += destinyLng + "," + destinyLat + ".json?";
            url += "&access_token=" + token;
            return _super.makeRequest(url);
        },
        getDistanceBetweenPoints: (latOrigin, lngOrigin, latDest, lngDest) => {
            return _super.getRoute(latOrigin, lngOrigin, latDest, lngDest).then(function (data) {
                let json = {};
                if (data.routes && data.routes.length > 0)
                    json = {
                        distance: utils.toFloat(data.routes[0].distance / 1000),
                        time: utils.toFloat(data.routes[0].duration / 60)
                    };
                return Promise.resolve(json);
            });
        },
        distanceMatrix: (latOrigin, lngOrigin, latDest, lngDest) => {
            let urlString = URL_BASE + "/directions-matrix/v1/mapbox/driving/";

            urlString += latOrigin + "," + lngOrigin + ";" + latDest + "," + lngDest;
            urlString += "?sources=1&annotations=distance,duration";
            urlString += "&access_token=" + token;
            return _super.makeRequest(urlString).then(function (data) {
                let d;
            });
        },
        requestAutocompletePlaces: function ({text, latitude, longitude, searchRadius, sessionToken}) {
            let urlString = URL_BASE + "/geocoding/v5/mapbox.places/";
            urlString += text + ".json?";
            urlString += "&access_token=" + token;
            urlString += "&autocomplete=true";
            urlString += "&limit=10";
            urlString += "&country=br";
            if (conf.maps.mapbox.viewport)
                urlString += "&bbox=" + conf.maps.mapbox.viewport;
            if (latitude && longitude)
                urlString += "&proximity=" + longitude + "," + latitude;
            return _super.makeRequest(urlString);
        },
        formatAddressComponent: function (data) {
            let address_components = data.context
            let json = {
                latitude: data.center[1],
                longitude: data.center[0],
                number: data.address,
                address: data.text,
                neighborhood: null,
                city: null,
                state: null,
                zip: null
            }, countFields = 0;
            for (let i = 0; i < address_components.length; i++) {
                let component = address_components[i];
                if (!json.neighborhood && component.id.indexOf("neighborhood") > 0) {
                    json.neighborhood = component.text;
                    countFields++;
                }
                if (!json.city && component.id.indexOf("place") >= 0) {
                    json.city = component.text;
                    countFields++;
                }
                if (!json.state && component.id.indexOf("region") >= 0) {
                    json.state = component.text;
                    countFields++;
                }
                if (!json.zip && component.id.indexOf("postcode") >= 0) {
                    json.zip = component.text;
                    countFields++;
                }
                if (countFields == 4) return Promise.resolve(json);
            }
            return Promise.resolve(json);
        },
        getPlaceInfoByPlaceId: function (placeId) {
            let urlString = URL_BASE + "/place/details/json?fields=name,address_components,geometry";
            urlString += "&key=" + Define.MapsKey;
            urlString += "&placeid=" + placeId;
            return _super.makeRequest(urlString).then(function (data) {
                if (data && data.error_message) {
                    console.log(data.error_message);
                }
                return _super.formatAddressComponent(data.result);
            });
        },
        getPlaceInfoByLatLng: function (lat, lng) {
            if (!lat || !lng) return Promise.resolve({});
            let urlString = URL_BASE + "/geocoding/v5/mapbox.places/";
            urlString += lng + "," + lat + ".json?";
            urlString += "&access_token=" + token;
            urlString += "&autocomplete=true";
            urlString += "&types=region%2Cpostcode%2Clocality%2Cplace%2Cneighborhood%2Caddress%2Cdistrict";
            urlString += "&limit=1";
            return _super.makeRequest(urlString).then(function (data) {
                if (data && data.error_message) {
                    console.log(data.error_message);
                }
                return _super.formatAddressComponent(data.features[0]);
            });
        },

        autocompletePlaces: function () {
            let promise;
            let minLength = conf.maps && conf.maps.minCharacter ? conf.maps.minCharacter : undefined;
            if (!minLength || _params.text.trim().length >= minLength)
                promise = _super.requestAutocompletePlaces({text: _params.text});
            else
                promise = Promise.resolve({predictions: [], features: []});

            return promise.then(function (data) {
                let places = {predictions: []};
                data = data.features;
                let jsonLocation;
                for (let i = 0; i < data.length; i++) {
                    jsonLocation = {lat: data[i].center[1], lng: data[i].center[0]}
                    places.predictions.push({
                        place_id: JSON.stringify(jsonLocation), // data[i].id,
                        structured_formatting: {
                            main_text: data[i].text,
                            secondary_text: data[i].place_name
                        },
                    });
                }
                return Promise.resolve(places);
            });
        },
        recoverInfo: function (placeId, lat, lng) {
            return placeId && placeId != "" ? _super.getPlaceInfoByPlaceId(placeId) : _super.getPlaceInfoByLatLng(lat, lng);
        },
        publicMethods: {
            getPlaceInformations: function () {
                if (utils.verifyRequiredFields(_params, ["latitude", "longitude"], _response)) {
                    return _super.getPlaceInfoByLatLng(_params.latitude, _params.longitude).then(function (data) {
                      return _response.success(data);
                    }, function (error) {
                        _response.error(error);
                    });
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
                if (_params.destinyPlaceId) {
                    let json = JSON.parse(_params.destinyPlaceId);
                    _params.destinyLat = json.lat;
                    _params.destinyLng = json.lng;
                    delete _params.destinyPlaceId;
                }
                if (_params.originPlaceId) {
                    let json = JSON.parse(_params.originPlaceId);
                    _params.originLat = json.lat;
                    _params.originLng = json.lng;
                    delete _params.originPlaceId;
                }
                promises.push(_super.recoverInfo(_params.originPlaceId, _params.originLat, _params.originLng));
                promises.push(_super.recoverInfo(_params.destinyPlaceId, _params.destinyLat, _params.destinyLng));
                return Promise.all(promises).then(function (resultPromises) {
                    // delete mapTokens[_currentUser.id];
                    route.origin.info = resultPromises[0];
                    route.destiny.info = resultPromises[1];
                    return _params.ignoreRoute ? Promise.resolve() : _super.getRoute(route.origin.info.latitude, route.origin.info.longitude, route.destiny.info.latitude, route.destiny.info.longitude);
                }).then(function (data) {
                    if (!_params.ignoreRoute) {
                        route.origin.coordinates = {
                            lat: route.origin.info.latitude,
                            lng: route.origin.info.longitude,
                        };
                        route.destiny.coordinates = {
                            lat: route.destiny.info.latitude,
                            lng: route.destiny.info.longitude
                        };
                        route.distance = Math.round(data.routes[0].distance);
                        route.duration = Math.round(data.routes[0].duration);
                        route.polyline = data.routes[0].geometry;
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

exports.instance = Mapbox;
for (var key in Mapbox().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Mapbox(request).publicMethods[request.functionName]();
    });
}
