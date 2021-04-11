'use strict';
const utils = require("../../Utils.js");
const Define = require('../../Define.js');

module.exports = {
    search: function (place, location) {
        let query = new Parse.Query(Define.PredictionsCache);
        query.equalTo("place", place);
        query.select(["predictions", "count", "clientLocation"]);
        if (location)
            query.near("clientLocation", location);
        else
            query.descending("createdAt");
        return query.first();
    },
    save: function (predictions, place, objectPlace, location) {
        let placeCache = objectPlace || (new Define.PredictionsCache);
        placeCache.set("place", place);
        if (placeCache.get("count") === undefined) {
            placeCache.set("count", 0);
        }
        placeCache.increment("count");
        if (location)
            placeCache.set("clientLocation", location);
        placeCache.set("cacheDate", utils.formatDate(new Date()));
        placeCache.set("predictions", predictions);
        return placeCache.save().then(function (object) {
            return Promise.resolve(predictions);
        }, function (error) {
            console.log(error.code, error.message);
        });
    }
};
