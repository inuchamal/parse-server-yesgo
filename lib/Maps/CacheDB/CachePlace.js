'use strict';
const utils = require("../../Utils.js");
const Define = require('../../Define.js');

module.exports = {
    search: function (placeId) {
        let query = new Parse.Query(Define.PlaceCache);
        query.equalTo("placeId", placeId);
        query.select(["details", "count"]);
        return query.first();
    },
    save: function (placeId, details, objectPlace) {
        let placeCache = objectPlace || (new Define.PlaceCache);
        placeCache.set("placeId", placeId);
        if (placeCache.get("count") === undefined) {
            placeCache.set("count", 0);
            placeCache.set("details", details);
        }
        placeCache.increment("count");
        return placeCache.save().then(function () {
            return Promise.resolve(details);
        });
    }
}
