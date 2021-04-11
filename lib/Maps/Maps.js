/**
 * Created by Patrick on 17/01/2019.
 */

'use strict';
const conf = require('config');
const utils = require("../Utils.js");
const Define = require('../Define.js');
let MapsModule = null;
try {
    if (!conf.maps || !conf.maps.module) throw ("Maps Module not defined");
    switch (conf.maps.module) {
        case 'google':
            MapsModule = require('./Gmaps.js');
            break;
        case 'mapbox':
            MapsModule = require('./MapBox.js');
            break;

    }
    // MapsModule.validate();
} catch (ex) {
    console.log("Error: ", ex)
    process.exit(1);
}
const response = require('../response');
function Maps_Module(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        getPlaceInfoByLatLng: function (latitude, longitude) {
            return MapsModule.instance().getPlaceInfoByLatLng(latitude, longitude);
        },
        getDistanceBetweenPoints: function (origin, destiny) {
            if (!origin || !destiny) return Promise.resolve({});
            return MapsModule.instance().getDistanceBetweenPoints(origin.latitude, origin.longitude, destiny.latitude, destiny.longitude);
        },
        makePartialRoute: (originPlaceId, originLat, originLng, destinyPlaceId, destinyLat, destinyLng, ignoreRoute) => {
            return MapsModule.instance().makePartialRoute(originPlaceId, originLat, originLng, destinyPlaceId, destinyLat, destinyLng, ignoreRoute)
        },
        publicMethods: {
            autocompletePlaces: function () {
                if (utils.verifyRequiredFields(_params, ["text"], _response)) {
                    let places = utils.removeDiacritics(_params.text.trim().toLowerCase()), objectPlace;
                    let {longitude, latitude, searchRadius} = _params;
                    searchRadius = searchRadius || 0;
                    let _location = longitude && latitude ? new Parse.GeoPoint({latitude, longitude}) : null;
                    let promise;
                    if (conf.disableCache)
                        promise = Promise.resolve(undefined);
                    else
                        promise = require("./CacheDB/CachePredictions").search(places, _location);
                    return promise.then(function (result) {
                        if (result) {
                            let predictions = result.get("predictions") ? (result.get("predictions").predictions || undefined) : undefined;
                            let clientLocation = result.get("clientLocation") || null;
                            let validRadius = clientLocation && _location ? _location.kilometersTo(clientLocation) < searchRadius : true;
                            if (predictions && Array.isArray(predictions) && predictions.length > 0 && validRadius) {
                                objectPlace = result;
                                return Promise.resolve(result.get("predictions"));
                            }
                        }
                        return MapsModule.instance(_request, _response).autocompletePlaces()
                    }).then(function (suc) {
                        return require("./CacheDB/CachePredictions").save(suc, places, objectPlace, _location);
                    }).then(function (predictions) {
                      return _response.success(predictions);
                    }, function (error) {
                        _response.error(error);
                    });
                }
            }
        }
    };
    return _super;
}


exports.instance = Maps_Module;
for (let key in Maps_Module().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        // Maps_Module(request).initModule();
       return await Maps_Module(request).publicMethods[request.functionName]();
    });
}
