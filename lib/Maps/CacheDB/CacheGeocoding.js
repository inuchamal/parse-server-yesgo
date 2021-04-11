'use strict';
const utils = require("../../Utils.js");
const Define = require('../../Define.js');

module.exports = {
    search: function (lat, lng) {
        let geopoint = new Parse.GeoPoint({latitude: lat, longitude: lng});
        let query = new Parse.Query(Define.GeocodingCache);
        query.equalTo("lat", lat);
        query.equalTo("lng", lng);
        query.select(["address", "count", "location"]);
        return query.first().then(function (geocoding) {
            if (geocoding) return Promise.resolve(geocoding);
            let query = new Parse.Query(Define.GeocodingCache);
            query.near("location", geopoint);
            query.select(["address", "count", "location"]);
            query.limit(1);
            return query.first().then(function (near) {
                return (!near || (near.get("location").kilometersTo(geopoint)) > 0.01) ? Promise.resolve() : Promise.resolve(near);
            });
        });
    },
    save: function (lat, lng, address, objectPlace) {
        let geopoint = new Parse.GeoPoint({latitude: lat, longitude: lng});
        let placeCache = objectPlace || (new Define.GeocodingCache());
        if (placeCache.get("count") === undefined) {
            placeCache.set("count", 0);
            placeCache.set("location", geopoint);
            placeCache.set("lat", lat);
            placeCache.set("lng", lng);
            placeCache.set("address", address);
        }
        placeCache.increment("count");
        return placeCache.save(null, {useMasterKey: true}).then(function () {
            return Promise.resolve(address);
        });
    }
}
