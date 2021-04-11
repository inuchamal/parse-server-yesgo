const MongoClient = require('mongodb').MongoClient;
const {config} = require('./config.js');
const url = config.databaseUri;

const utils = {
    clearDB: MongoClient.connect(url, {useNewUrlParser: true}, (err, db) => {
        if (err) throw err;
        let database = db.db("DemoDev-Test");

        database.collection("_User").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("_User deleted");
        });

        database.collection("_Session").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("_Session deleted");
        });

        database.collection("Vehicle").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Vehicle deleted");
        });

        database.collection("Category").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Category deleted");
        });

        database.collection("DeviceInfo").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("DeviceInfo deleted");
        });

        database.collection("Document").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Document deleted");
        });

        database.collection("Activity").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Activity deleted");
        });

        database.collection("UserDocument").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("UserDocument deleted");
        });

        database.collection("Radius").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Radius deleted");
        });

        database.collection("Travel").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Travel deleted");
        });

        database.collection("Fare").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Fare deleted");
        });

        database.collection("Card").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Card deleted");
        });

        database.collection("HourCycle").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("HourCycle deleted");
        });

        database.collection("inDebtLog").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("inDebtLog deleted");
        });

        database.collection("MonthlyGain").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("MonthlyGain deleted");
        });

        database.collection("Logger").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Logger deleted");
        });

        database.collection("_PushStatus").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("_PushStatus deleted");
        });

        database.collection("BankAccount").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("BankAccount deleted");
        });

        database.collection("Plan").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Plan deleted");
        });

        database.collection("Cancellation").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Cancellation deleted");
        });

        database.collection("Logger").drop(function (err, res) {
            if (err) throw err;
            if (res) console.log("Logger deleted");
        });

        db.close();
        return;
    }),
};

module.exports = utils;
