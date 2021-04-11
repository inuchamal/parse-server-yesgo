'use strict';
const {config} = require('../config');
const faker = require('faker/locale/pt_BR');
const appId = config.appId;

let Faker = {
    createCategory: function (amountCategory) {
        let categories = [];
        for (let i = 0; i < amountCategory; i = i + 1) {
            let category = {
                _ApplicationId: appId,
                name: "Barco",
                description: "Jet Ski",
                description_en: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
                active: true,
                year: "2010"
            };
            categories.push(category);
        }
        return categories;
    },

    createCategoryDeactivate: function (amountCategory) {
        let categories = [];
        for (let i = 0; i < amountCategory; i = i + 1) {
            let category = {
                _ApplicationId: appId,
                name: "Barco",
                description: "Jet Ski",
                description_en: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
                active: false,
                year: "2010"
            };
            categories.push(category);
        }
        return categories;
    }
};
module.exports = Faker;